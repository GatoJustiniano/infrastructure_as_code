terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region              = var.region
  allowed_account_ids = [var.aws_account_id]
  default_tags {
    tags = {
      Proyecto    = var.proyecto
      Ambiente    = var.ambiente
      Herramienta = "terraform"
    }
  }
}

# Zonas donde existe el tipo de instancia (no todas las AZ ofrecen todos los tipos)
data "aws_ec2_instance_type_offerings" "zonas" {
  location_type = "availability-zone"
  filter {
    name   = "instance-type"
    values = [var.instance_type]
  }
}

locals {
  prefijo = "${var.proyecto}-tf-${var.ambiente}"
  zona    = sort(data.aws_ec2_instance_type_offerings.zonas.locations)[0]
}

module "network" {
  source            = "./modules/network"
  prefijo           = local.prefijo
  availability_zone = local.zona
}

module "security" {
  source  = "./modules/security"
  prefijo = local.prefijo
  vpc_id  = module.network.vpc_id
}

module "compute" {
  source            = "./modules/compute"
  prefijo           = local.prefijo
  instance_type     = var.instance_type
  subnet_id         = module.network.subnet_id
  security_group_id = module.security.security_group_id

  user_data = templatefile("${path.module}/../cloud-init/cloud-init.yaml", {
    RepoUrl    = var.repo_url
    RepoBranch = var.repo_branch
    AdminKey   = var.admin_key
    Ambiente   = var.ambiente
  })
}
