import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export interface SeguridadArgs {
    prefijo: string;
    vpcId: pulumi.Input<string>;
    puertos?: number[];
    cidrPermitido?: string;
}

// Security Group: 80 para la app, 22 para EC2 Instance Connect
export class Seguridad extends pulumi.ComponentResource {
    public readonly securityGroupId: pulumi.Output<string>;

    constructor(name: string, args: SeguridadArgs, opts?: pulumi.ComponentResourceOptions) {
        super("asistencia:infra:Seguridad", name, {}, opts);
        const cidr = args.cidrPermitido ?? "0.0.0.0/0";

        const sg = new aws.ec2.SecurityGroup(`${name}-sg`, {
            name: `${args.prefijo}-sg`,
            description: "Acceso a la app y SSH",
            vpcId: args.vpcId,
            ingress: (args.puertos ?? [80, 22]).map((puerto) => ({
                protocol: "tcp", fromPort: puerto, toPort: puerto, cidrBlocks: [cidr],
            })),
            egress: [{ protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }],
            tags: { Name: `${args.prefijo}-sg` },
        }, { parent: this });

        this.securityGroupId = sg.id;
        this.registerOutputs({ securityGroupId: this.securityGroupId });
    }
}
