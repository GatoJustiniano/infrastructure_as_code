import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface RedArgs {
    prefijo: string;
    // Tipo de instancia que se lanzará en la subred: se elige una zona que lo ofrezca
    instanceType: string;
    vpcCidr?: string;
    subnetCidr?: string;
}

// VPC, subred pública, Internet Gateway y ruteo
export class Red extends pulumi.ComponentResource {
    public readonly vpcId: pulumi.Output<string>;
    public readonly subnetId: pulumi.Output<string>;

    constructor(name: string, args: RedArgs, opts?: pulumi.ComponentResourceOptions) {
        super("asistencia:infra:Red", name, {}, opts);
        const p = { parent: this };

        const vpc = new aws.ec2.Vpc(`${name}-vpc`, {
            cidrBlock: args.vpcCidr ?? "10.0.0.0/16",
            enableDnsHostnames: true,
            enableDnsSupport: true,
            tags: { Name: `${args.prefijo}-vpc` },
        }, p);

        const zonas = aws.ec2.getInstanceTypeOfferingsOutput({
            locationType: "availability-zone",
            filters: [{ name: "instance-type", values: [args.instanceType] }],
        }, p);

        const subnet = new aws.ec2.Subnet(`${name}-subnet`, {
            vpcId: vpc.id,
            cidrBlock: args.subnetCidr ?? "10.0.1.0/24",
            availabilityZone: zonas.locations.apply((z) => [...z].sort()[0]),
            mapPublicIpOnLaunch: true,
            tags: { Name: `${args.prefijo}-subnet-publica` },
        }, p);

        const igw = new aws.ec2.InternetGateway(`${name}-igw`, {
            vpcId: vpc.id,
            tags: { Name: `${args.prefijo}-igw` },
        }, p);

        const rt = new aws.ec2.RouteTable(`${name}-rt`, {
            vpcId: vpc.id,
            routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: igw.id }],
            tags: { Name: `${args.prefijo}-rt-publica` },
        }, p);

        const rta = new aws.ec2.RouteTableAssociation(`${name}-rta`, {
            subnetId: subnet.id,
            routeTableId: rt.id,
        }, p);

        this.vpcId = vpc.id;
        // Depende de la asociación para que la instancia no arranque sin salida a Internet
        this.subnetId = rta.subnetId.apply((id) => id!);
        this.registerOutputs({ vpcId: this.vpcId, subnetId: this.subnetId });
    }
}
