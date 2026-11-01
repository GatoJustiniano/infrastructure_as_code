# Sistema de Asistencia: Infraestructura como Código con cloud-init

Una aplicación (backend Node.js + Express + SQLite y frontend en JavaScript vanilla) desplegada en AWS EC2 con **tres herramientas de IaC**: Terraform, CloudFormation y Pulumi.
Las tres crean la misma infraestructura y configuran el servidor con **cloud-init**, que **clona el backend y el frontend desde GitHub** y deja la app corriendo como servicio.

## Estructura
Las tres herramientas siguen la misma división en **red → seguridad → cómputo**, cada pieza en su propio archivo y conectadas solo por entradas y salidas.
```
backend/                       API (server.js) y utilidades de Excel
  demo/demo.json               Datos demo: estudiantes (216######) y horario de clases
  demo/seed.js                 Carga la demo si el módulo activo está vacío (DEMO_DATA=true)
frontend/                      Páginas del estudiante y del docente
cloud-init/cloud-init.yaml     Configuración del servidor (compartida)

terraform/
  main.tf                      Raíz: provider, tags comunes y llamada a los módulos
  variables.tf / outputs.tf
  environments/dev.tfvars      Valores por ambiente (también prod.tfvars)
  modules/network/             VPC, subred, IGW, ruteo
  modules/security/            Security Group (puertos configurables)
  modules/compute/             EC2 + AMI Amazon Linux 2023

cloudformation/
  main.yaml                    Stack padre: parámetros y stacks anidados
  templates/network.yaml       Stack anidado de red
  templates/security.yaml      Stack anidado de seguridad
  templates/compute.yaml       Stack anidado de cómputo (lleva una copia del cloud-init)
  parametros/dev.json          Valores por ambiente (también prod.json)

pulumi/
  index.ts                     Programa principal: lee la config y conecta los componentes
  componentes/red.ts           ComponentResource de red
  componentes/seguridad.ts     ComponentResource de seguridad
  componentes/computo.ts       ComponentResource de cómputo
  componentes/cloudInit.ts     Renderiza cloud-init/cloud-init.yaml
  Pulumi.dev.yaml              Config por stack (también Pulumi.prod.yaml)
```

Los recursos se nombran `asistencia-<herramienta>-<ambiente>-...` (por ejemplo `asistencia-tf-dev-vpc`), así las tres herramientas y varios ambientes pueden convivir en la misma cuenta.

## Qué hace cada despliegue
1. Crea una VPC, una subred pública, un Internet Gateway, una tabla de ruteo y un Security Group (puertos 80 y 22).
2. Lanza una instancia EC2 `t3.micro` con Amazon Linux 2023 en `us-east-1`.
3. cloud-init instala `git` y `nodejs`, descarga **solo `backend/` y `frontend/`** de este repositorio en `/opt/asistencia`, ejecuta `npm ci` en `backend/` y crea el servicio `asistencia` (systemd) en el puerto 80.

Variables (las tres herramientas usan las mismas): `RepoUrl`, `RepoBranch`, `AdminKey` (contraseña del panel docente) y `Ambiente`.

> El repositorio debe ser **público** y tener `backend/` y `frontend/` en la rama indicada, porque la instancia lo clona al arrancar.

### Qué se descarga del repositorio
cloud-init usa un clonado parcial (*sparse checkout*), así el servidor no recibe las plantillas de infraestructura:
```
git clone --depth 1 --filter=blob:none --sparse --branch main <repo> /opt/asistencia
git -C /opt/asistencia sparse-checkout set backend frontend
```
- `--depth 1`: solo el último commit, sin historial.
- `--filter=blob:none --sparse`: no descarga el contenido de los archivos hasta que se piden.
- `sparse-checkout set backend frontend`: solo materializa esas dos carpetas. `terraform/`, `cloudformation/`, `pulumi/` y `cloud-init/` nunca llegan al servidor. Los archivos sueltos de la raíz (`README.md`, `.gitignore`) sí se incluyen, porque git siempre los trae en este modo.

## Despliegue

### Credenciales (cuenta 207381449073)
Terraform y Pulumi solo permiten desplegar en la cuenta **207381449073** (`allowed_account_ids`). CloudFormation no tiene ese candado, así que revisa la cuenta antes de cada despliegue:
```
aws configure --profile andres
set AWS_PROFILE=andres          (PowerShell: $env:AWS_PROFILE="andres"; Linux/Mac: export AWS_PROFILE=andres)
aws sts get-caller-identity     (debe mostrar "Account": "207381449073")
```

### Terraform
Un workspace por ambiente, para que cada uno tenga su propio estado:
```
cd terraform
terraform init
terraform workspace new dev
terraform apply -var-file=environments/dev.tfvars
terraform destroy -var-file=environments/dev.tfvars
```

### CloudFormation (stacks anidados)
Los stacks anidados deben estar en S3. `package` sube `templates/*.yaml` a un bucket y genera `empaquetado.yaml` con las URLs ya reemplazadas:
```
cd cloudformation
aws s3 mb s3://asistencia-cfn-templates-207381449073 --region us-east-1
aws cloudformation package --template-file main.yaml --s3-bucket asistencia-cfn-templates-207381449073 --output-template-file empaquetado.yaml
aws cloudformation deploy --region us-east-1 --stack-name asistencia-cfn-dev --template-file empaquetado.yaml --parameter-overrides file://parametros/dev.json --tags Proyecto=asistencia Ambiente=dev Herramienta=cloudformation
aws cloudformation describe-stacks --region us-east-1 --stack-name asistencia-cfn-dev --query "Stacks[0].Outputs"
aws cloudformation delete-stack --region us-east-1 --stack-name asistencia-cfn-dev
```
El bucket se crea una sola vez. Después de cambiar cualquier plantilla, vuelve a ejecutar `package` y `deploy`.

**Actualizar el servidor.** El UserData (cloud-init) está en un `AWS::EC2::LaunchTemplate`. Cuando cambia, se crea una versión nueva de la plantilla de lanzamiento y CloudFormation **reemplaza** la instancia, así cloud-init vuelve a ejecutarse. Si el UserData estuviera directo en la instancia, CloudFormation solo la reiniciaría y cloud-init no correría de nuevo.
- Cambiaste `templates/*.yaml` o el cloud-init: `package` + `deploy`.
- Solo subiste cambios de la app a GitHub (la plantilla no cambió): en `parametros/dev.json` sube `"VersionDespliegue"` (`"1"` → `"2"`, luego `"3"`...) y ejecuta el mismo `deploy`. Eso fuerza un servidor nuevo que vuelve a clonar la app. El servidor nuevo tiene otra IP y empieza con la base de datos vacía (vuelve a cargar la demo).

### Pulumi
```
cd pulumi
npm install
pulumi login --local
set PULUMI_CONFIG_PASSPHRASE=asistencia      (PowerShell: $env:PULUMI_CONFIG_PASSPHRASE="asistencia")
pulumi stack init dev
pulumi config set --secret adminKey <clave>
pulumi up
pulumi destroy
```

Al terminar, abre la URL que muestra el output (`http://<IP>`). cloud-init tarda unos 3 a 5 minutos en dejar la app lista.

## Diagnóstico en el servidor
Conéctate con **EC2 Instance Connect** desde la consola de AWS y revisa:
```
sudo cat /var/log/cloud-init-output.log
sudo systemctl status asistencia
sudo journalctl -u asistencia -f
```

## Ejecutar la app en local
```
cd backend
npm install
copy .env.example .env        (Linux/Mac: cp .env.example .env)
npm start
```
Abre **http://localhost:3000**. Formato de los Excel:
- Estudiantes: `Número de registro`, `Nombre completo`, `Correo electrónico`
- Fechas: `Fecha`, `Hora inicio`, `Hora fin`

## Datos demo
Con `DEMO_DATA=true` (cloud-init ya lo activa), al arrancar el servidor carga [backend/demo/demo.json](backend/demo/demo.json) si el módulo activo no tiene estudiantes:
- Los estudiantes de `demo.json`, con registro `216######`. Cualquiera sirve para ingresar como estudiante, por ejemplo `216207795`. Para agregar más, añade objetos a la lista `estudiantes`.
- Clases martes y jueves de 19:00 a 21:00, desde 4 semanas atrás hasta 3 semanas adelante, más el día de hoy para poder marcar.
- Asistencia de las clases pasadas generada (≈78 % puntual, 12 % atraso, 10 % falta). Siempre sale igual para el mismo estudiante y fecha.

Las fechas se calculan desde el día del arranque, así que la demo nunca queda vieja. Si importas tus propios Excel, la demo no vuelve a cargarse.
