import * as fs from "fs";
import * as path from "path";
import * as pulumi from "@pulumi/pulumi";

const PLANTILLA = path.join(__dirname, "..", "..", "cloud-init", "cloud-init.yaml");

// Reemplaza las variables ${...} de la plantilla cloud-init compartida
export function renderCloudInit(vars: Record<string, pulumi.Input<string>>): pulumi.Output<string> {
    const plantilla = fs.readFileSync(PLANTILLA, "utf8");
    return pulumi.all(vars).apply((valores) =>
        Object.entries(valores).reduce(
            (texto, [clave, valor]) => texto.split("${" + clave + "}").join(valor),
            plantilla,
        ),
    );
}
