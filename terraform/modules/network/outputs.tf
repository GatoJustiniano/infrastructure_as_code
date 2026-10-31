output "vpc_id" {
  value = aws_vpc.this.id
}

# Depende de la asociación para que la instancia no arranque sin salida a Internet
output "subnet_id" {
  value = aws_route_table_association.public.subnet_id
}
