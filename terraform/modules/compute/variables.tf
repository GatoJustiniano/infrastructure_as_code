variable "prefijo" {
  type = string
}

variable "instance_type" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "security_group_id" {
  type = string
}

variable "user_data" {
  description = "cloud-init ya renderizado"
  type        = string
}
