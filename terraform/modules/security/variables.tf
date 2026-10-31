variable "prefijo" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "puertos_ingreso" {
  description = "80 para la app, 22 para EC2 Instance Connect"
  type        = list(number)
  default     = [80, 22]
}

variable "cidr_permitido" {
  type    = string
  default = "0.0.0.0/0"
}
