import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface ComputoArgs {
    prefijo: string;
    instanceType: string;
    subnetId: pulumi.Input<string>;
    securityGroupId: pulumi.Input<string>;
    userData: pulumi.Input<string>;
}

// Instancia EC2 con Amazon Linux 2023 configurada con cloud-init
export class Computo extends pulumi.ComponentResource {
    public readonly publicIp: pulumi.Output<string>;
    public readonly instanceId: pulumi.Output<string>;

    constructor(name: string, args: ComputoArgs, opts?: pulumi.ComponentResourceOptions) {
        super("asistencia:infra:Computo", name, {}, opts);

        const ami = aws.ec2.getAmiOutput({
            mostRecent: true,
            owners: ["amazon"],
            filters: [{ name: "name", values: ["al2023-ami-2023.*-x86_64"] }],
        }, { parent: this });

        const servidor = new aws.ec2.Instance(`${name}-servidor`, {
            ami: ami.id,
            instanceType: args.instanceType,
            subnetId: args.subnetId,
            vpcSecurityGroupIds: [args.securityGroupId],
            userData: args.userData,
            userDataReplaceOnChange: true,
            tags: { Name: `${args.prefijo}-servidor` },
        }, { parent: this });

        this.publicIp = servidor.publicIp;
        this.instanceId = servidor.id;
        this.registerOutputs({ publicIp: this.publicIp, instanceId: this.instanceId });
    }
}
