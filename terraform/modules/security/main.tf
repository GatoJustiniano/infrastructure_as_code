resource "aws_security_group" "app" {
  name        = "${var.prefijo}-sg"
  description = "Acceso a la app y SSH"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.prefijo}-sg" }
}

resource "aws_vpc_security_group_ingress_rule" "puertos" {
  for_each          = toset([for p in var.puertos_ingreso : tostring(p)])
  security_group_id = aws_security_group.app.id
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = var.cidr_permitido
}

resource "aws_vpc_security_group_egress_rule" "todo" {
  security_group_id = aws_security_group.app.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}
