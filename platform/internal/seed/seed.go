package seed

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"github.com/labbed/platform/internal/domain/collection"
	"github.com/labbed/platform/internal/domain/nosimage"
	"github.com/labbed/platform/internal/domain/organization"
	tmpl "github.com/labbed/platform/internal/domain/template"
)

// Template holds a sample topology definition with optional bind files.
type Template struct {
	Name       string
	Type       string // "network" (default) | "cloud"
	Definition string
	BindFiles  []BindFile
}

// BindFile represents a file to bind-mount into a topology node.
type BindFile struct {
	FilePath string
	Content  string
	NosKind  string // "" = universal, "mikrotik_ros", "frr", "openwrt", "freebsd"
}

// CollectionDef groups templates under a named collection.
type CollectionDef struct {
	Name      string
	Templates []Template
}

// collections aggregates all themed collection definitions from per-file vars.
var collections = []CollectionDef{
	routingCollection,
	campusCollection,
	switchingCollection,
	firewallCollection,
	servicesCollection,
	cloudCollection,
	datacenterCollection,
}

// SeedDefaults creates a default org, sample collections, and starter
// topologies if they don't already exist. Expects the admin user's internal ID.
func SeedDefaults(db *gorm.DB, adminUserID uint) {
	defaultOrgID := ensureDefaultOrg(db, adminUserID)
	SeedSampleTemplates(db, defaultOrgID, adminUserID)
	SeedNosImages(db)
}

// SeedNosImages creates system-level NOS images if they don't already exist.
func SeedNosImages(db *gorm.DB) {
	systemImages := []nosimage.NosImage{
		{
			UUID:        uuid.New().String(),
			Name:        "FRR 10.3.1",
			ClabKind:    "linux",
			DockerImage: "quay.io/frrouting/frr:10.3.1",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Labbed Host (Alpine Nettools)",
			ClabKind:    "linux",
			DockerImage: "ghcr.io/vivek-dodia/labbed-host:latest",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "GoBGP",
			ClabKind:    "linux",
			DockerImage: "osrg/gobgp:latest",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Kea DHCP Server",
			ClabKind:    "linux",
			DockerImage: "docker.cloudsmith.io/isc/docker/kea-dhcp4:2.6",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "CoreDNS",
			ClabKind:    "linux",
			DockerImage: "coredns/coredns:1.12.0",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Nginx (Load Balancer)",
			ClabKind:    "linux",
			DockerImage: "nginx:alpine",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "osvBNG 0.3.1",
			ClabKind:    "veesix_osvbng",
			DockerImage: "veesixnetworks/osvbng:0.3.1",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "FreeBSD 14",
			ClabKind:    "freebsd",
			DockerImage: "vrnetlab/freebsd:14",
			DefaultUser: "admin",
			DefaultPass: "admin",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "OpenWrt 24.10.0",
			ClabKind:    "openwrt",
			DockerImage: "vrnetlab/openwrt_openwrt:24.10.0",
			DefaultUser: "root",
			DefaultPass: "VR-netlab9",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "RouterOS CHR 7.20.8",
			ClabKind:    "mikrotik_ros",
			DockerImage: "vrnetlab/mikrotik_routeros:7.20.8",
			DefaultUser: "admin",
			DefaultPass: "admin",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Nokia SR Linux 24.10.1",
			ClabKind:    "srl",
			DockerImage: "ghcr.io/nokia/srlinux:24.10.1",
			DefaultUser: "admin",
			DefaultPass: "NokiaSrl1!",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "SONiC VS",
			ClabKind:    "sonic-vs",
			DockerImage: "netreplica/docker-sonic-vs:latest",
			DefaultUser: "admin",
			DefaultPass: "YourPaSsWoRd",
			IsSystem:    true,
			OrgID:       0,
		},
	}

	for _, img := range systemImages {
		var count int64
		db.Model(&nosimage.NosImage{}).Where("docker_image = ? AND is_system = ?", img.DockerImage, true).Count(&count)
		if count > 0 {
			continue
		}
		if err := db.Create(&img).Error; err != nil {
			log.Printf("seed: failed to create NOS image %q: %v", img.Name, err)
			continue
		}
		log.Printf("seed: created system NOS image %q", img.Name)
	}
}

// SeedSampleTemplates creates themed sample collections with topologies
// for the given org, skipping any collection that already exists.
func SeedSampleTemplates(db *gorm.DB, orgID uint, creatorID uint) {
	for _, colDef := range collections {
		var count int64
		db.Model(&collection.Collection{}).Where("name = ? AND org_id = ?", colDef.Name, orgID).Count(&count)
		if count > 0 {
			continue
		}

		col := &collection.Collection{
			UUID:       uuid.New().String(),
			Name:       colDef.Name,
			OrgID:      orgID,
			CreatorID:  creatorID,
			PublicRead: true,
		}
		if err := db.Create(col).Error; err != nil {
			log.Printf("seed: failed to create collection %q for org %d: %v", colDef.Name, orgID, err)
			continue
		}

		member := &collection.CollectionMember{
			CollectionID: col.ID,
			UserID:       creatorID,
			Role:         "owner",
		}
		db.Create(member)

		for _, t := range colDef.Templates {
			templateType := t.Type
			if templateType == "" {
				templateType = "network"
			}
			topo := &tmpl.Template{
				UUID:         uuid.New().String(),
				Name:         t.Name,
				Type:         templateType,
				Definition:   t.Definition,
				OrgID:        orgID,
				CollectionID: col.ID,
				CreatorID:    creatorID,
			}
			if err := db.Create(topo).Error; err != nil {
				log.Printf("seed: failed to create template %q: %v", t.Name, err)
				continue
			}

			for _, bf := range t.BindFiles {
				file := &tmpl.BindFile{
					UUID:       uuid.New().String(),
					TemplateID: topo.ID,
					FilePath:   bf.FilePath,
					Content:    []byte(bf.Content),
					NosKind:    bf.NosKind,
				}
				db.Create(file)
			}
		}

		log.Printf("seed: created %q collection with %d templates for org %d", colDef.Name, len(colDef.Templates), orgID)
	}
}

// ensureDefaultOrg creates the "Default" organization if it doesn't exist and
// makes the admin user its owner. Returns the org's database ID.
func ensureDefaultOrg(db *gorm.DB, adminUserID uint) uint {
	var org organization.Organization
	if err := db.Where("slug = ?", "default").First(&org).Error; err == nil {
		return org.ID
	}

	org = organization.Organization{
		UUID:       uuid.New().String(),
		Name:       "Default",
		Slug:       "default",
		Plan:       "heavy",
		MaxLabs:    0,
		MaxWorkers: 0,
	}
	if err := db.Create(&org).Error; err != nil {
		log.Printf("seed: failed to create default org: %v", err)
		return 0
	}

	member := &organization.OrganizationMember{
		OrgID:  org.ID,
		UserID: adminUserID,
		Role:   organization.RoleOwner,
	}
	db.Create(member)

	log.Printf("seed: created default organization (id=%d)", org.ID)

	db.Model(&collection.Collection{}).Where("org_id = 0").Update("org_id", org.ID)
	db.Table("templates").Where("org_id = 0").Update("org_id", org.ID)
	db.Table("labs").Where("org_id = 0").Update("org_id", org.ID)

	return org.ID
}
