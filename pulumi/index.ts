import * as pulumi from "@pulumi/pulumi";
import { Red } from "./componentes/red";
import { Seguridad } from "./componentes/seguridad";
import { Computo } from "./componentes/computo";
import { renderCloudInit } from "./componentes/cloudInit";

const config = new pulumi.Config();
const proyecto = config.get("proyecto") ?? "asistencia";
const ambiente = config.get("ambiente") ?? pulumi.getStack();
const prefijo = `${proyecto}-pulumi-${ambiente}`;
const instanceType = config.get("instanceType") ?? "t3.micro";

const red = new Red("red", { prefijo, instanceType });

const seguridad = new Seguridad("seguridad", { prefijo, vpcId: red.vpcId });

const computo = new Computo("computo", {
    prefijo,
    instanceType,
    subnetId: red.subnetId,
    securityGroupId: seguridad.securityGroupId,
    userData: renderCloudInit({
        RepoUrl: config.get("repoUrl") ?? "https://github.com/GatoJustiniano/infrastructure_as_code.git",
        RepoBranch: config.get("repoBranch") ?? "main",
        AdminKey: config.getSecret("adminKey") ?? pulumi.secret("admin123"),
        Ambiente: ambiente,
    }),
});

export const urlApp = pulumi.interpolate`http://${computo.publicIp}`;
export const instanciaId = computo.instanceId;
