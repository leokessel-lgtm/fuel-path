terraform {
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 6.0.0"
    }
  }
}

provider "oci" {
  region = var.region
}

resource "oci_core_instance" "fuel_path_gnaf_vm" {
  availability_domain = var.availability_domain
  compartment_id      = var.compartment_ocid
  display_name        = "fuel-path-gnaf-vm"
  shape               = "VM.Standard.A1.Flex"

  shape_config {
    ocpus         = 1
    memory_in_gbs = 6
  }

  create_vnic_details {
    assign_public_ip = true
    display_name     = "fuel-path-gnaf-vnic"
    subnet_id        = var.subnet_id
  }

  metadata = {
    ssh_authorized_keys = var.ssh_public_key
  }

  source_details {
    source_type             = "image"
    source_id               = var.oracle_linux_9_aarch64_image_ocid
    boot_volume_size_in_gbs = "180"
  }
}

output "public_ip" {
  value = oci_core_instance.fuel_path_gnaf_vm.public_ip
}

output "private_ip" {
  value = oci_core_instance.fuel_path_gnaf_vm.private_ip
}
