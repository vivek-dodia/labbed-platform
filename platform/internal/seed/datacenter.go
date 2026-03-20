package seed

var datacenterCollection = CollectionDef{
	Name: "Datacenter Fabric",
	Templates: []Template{
		{
			Name: "Leaf-Spine eBGP Fabric (SR Linux)",
			Definition: `name: srl-leaf-spine

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    spine2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf3:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    server1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    server2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    server3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest

  links:
    - endpoints: ["spine1:e1-1", "leaf1:e1-49"]
    - endpoints: ["spine1:e1-2", "leaf2:e1-49"]
    - endpoints: ["spine1:e1-3", "leaf3:e1-49"]
    - endpoints: ["spine2:e1-1", "leaf1:e1-50"]
    - endpoints: ["spine2:e1-2", "leaf2:e1-50"]
    - endpoints: ["spine2:e1-3", "leaf3:e1-50"]
    - endpoints: ["leaf1:e1-1", "server1:eth1"]
    - endpoints: ["leaf2:e1-1", "server2:eth1"]
    - endpoints: ["leaf3:e1-1", "server3:eth1"]
`,
		},
		{
			Name: "2-Spine 4-Leaf Fabric (SR Linux)",
			Definition: `name: srl-2s4l

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    spine2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf3:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf4:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    h1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    h2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    h3:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    h4:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest

  links:
    - endpoints: ["spine1:e1-1", "leaf1:e1-49"]
    - endpoints: ["spine1:e1-2", "leaf2:e1-49"]
    - endpoints: ["spine1:e1-3", "leaf3:e1-49"]
    - endpoints: ["spine1:e1-4", "leaf4:e1-49"]
    - endpoints: ["spine2:e1-1", "leaf1:e1-50"]
    - endpoints: ["spine2:e1-2", "leaf2:e1-50"]
    - endpoints: ["spine2:e1-3", "leaf3:e1-50"]
    - endpoints: ["spine2:e1-4", "leaf4:e1-50"]
    - endpoints: ["leaf1:e1-1", "h1:eth1"]
    - endpoints: ["leaf2:e1-1", "h2:eth1"]
    - endpoints: ["leaf3:e1-1", "h3:eth1"]
    - endpoints: ["leaf4:e1-1", "h4:eth1"]
`,
		},
		{
			Name: "SONiC Leaf-Spine Fabric",
			Definition: `name: sonic-fabric

topology:
  nodes:
    spine1:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    spine2:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    leaf1:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    leaf2:
      kind: sonic-vs
      image: netreplica/docker-sonic-vs:latest
    server1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    server2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest

  links:
    - endpoints: ["spine1:eth1", "leaf1:eth1"]
    - endpoints: ["spine1:eth2", "leaf2:eth1"]
    - endpoints: ["spine2:eth1", "leaf1:eth2"]
    - endpoints: ["spine2:eth2", "leaf2:eth2"]
    - endpoints: ["leaf1:eth3", "server1:eth1"]
    - endpoints: ["leaf2:eth3", "server2:eth1"]
`,
		},
		{
			Name: "SR Linux + FRR Mixed Fabric",
			Definition: `name: srl-frr-mixed

topology:
  nodes:
    spine1:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    spine2:
      kind: srl
      image: ghcr.io/nokia/srlinux:24.10.1
    leaf1:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
    leaf2:
      kind: linux
      image: quay.io/frrouting/frr:10.3.1
    h1:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest
    h2:
      kind: linux
      image: ghcr.io/vivek-dodia/labbed-host:latest

  links:
    - endpoints: ["spine1:e1-1", "leaf1:eth1"]
    - endpoints: ["spine1:e1-2", "leaf2:eth1"]
    - endpoints: ["spine2:e1-1", "leaf1:eth2"]
    - endpoints: ["spine2:e1-2", "leaf2:eth2"]
    - endpoints: ["leaf1:eth3", "h1:eth1"]
    - endpoints: ["leaf2:eth3", "h2:eth1"]
`,
		},
	},
}
