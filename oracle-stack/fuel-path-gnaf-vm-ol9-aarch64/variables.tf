variable "region" {
  type    = string
  default = "ap-sydney-1"
}

variable "tenancy_ocid" {
  type = string
}

variable "compartment_ocid" {
  type = string
}

variable "availability_domain" {
  type    = string
  default = "Lljc:AP-SYDNEY-1-AD-1"
}

variable "subnet_id" {
  type    = string
  default = "ocid1.subnet.oc1.ap-sydney-1.aaaaaaaalm3zw6doyjnbgrwfp6epn4do2leq2jlx4ythqxguq5qvowu5zfxa"
}

variable "oracle_linux_9_aarch64_image_ocid" {
  type    = string
  default = "ocid1.image.oc1.ap-sydney-1.aaaaaaaaoco3d4vovtggazpgafohlzdojiu2tnyvidcrq5vnmfmqy4dtpasa"
}

variable "ssh_public_key" {
  type    = string
  default = "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG0AEycKMnEcQCT7iabRi8VMGcEDAZDZPU+c0lDRJExh fuel-path-oracle-gnaf"
}
