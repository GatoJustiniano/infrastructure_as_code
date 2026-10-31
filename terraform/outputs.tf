output "url_app" {
  value = "http://${module.compute.public_ip}"
}

output "instancia_id" {
  value = module.compute.instance_id
}
