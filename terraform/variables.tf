variable "aws_account_id" {
  description = "Solo se permite desplegar en esta cuenta"
  type        = string
  default     = "207381449073"
}

variable "region" {
  type    = string
  default = "us-east-1"
}

variable "proyecto" {
  type    = string
  default = "asistencia"
}

variable "ambiente" {
  type    = string
  default = "dev"
  validation {
    condition     = contains(["dev", "qa", "prod"], var.ambiente)
    error_message = "ambiente debe ser dev, qa o prod."
  }
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "repo_url" {
  description = "Repositorio público con backend/ y frontend/"
  type        = string
  default     = "https://github.com/GatoJustiniano/infrastructure_as_code.git"
}

variable "repo_branch" {
  type    = string
  default = "main"
}

variable "admin_key" {
  description = "Contraseña del panel docente"
  type        = string
  default     = "admin123"
  sensitive   = true
}
