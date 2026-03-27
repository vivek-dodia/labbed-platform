package seed

import (
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"encoding/json"

	"github.com/labbed/platform/internal/domain/collection"
	"github.com/labbed/platform/internal/domain/guide"
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
	Guide      *Guide // optional learning guide
	Draft      bool   // Draft templates are kept in code but not seeded
}

// BindFile represents a file to bind-mount into a topology node.
type BindFile struct {
	FilePath string
	Content  string
	NosKind  string // "" = universal, "mikrotik_ros", "frr", "openwrt", "freebsd"
}

// Guide defines a step-by-step learning guide for a template.
type Guide struct {
	Title         string
	Description   string
	Difficulty    string // beginner, intermediate, advanced
	Concepts      []string
	TopologyNotes string
	EstimatedTime string
	Steps         []GuideStep
}

// GuideStep is a single step in a learning guide.
type GuideStep struct {
	Title       string
	Description string
	Hint        string
	Validation  *StepValidation
}

// StepValidation defines how to verify a step is complete.
type StepValidation struct {
	Node        string
	Command     string
	Pattern     string
	NosVariants map[string]NosVariant
}

// NosVariant provides NOS-specific command/pattern overrides.
type NosVariant struct {
	Command string
	Pattern string
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
	l2vpnCollection,
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
	SeedGuides(db)
}

// SeedNosImages creates system-level NOS images if they don't already exist.
func SeedNosImages(db *gorm.DB) {
	systemImages := []nosimage.NosImage{
		{
			UUID:        uuid.New().String(),
			Name:        "FRR 10.3.1",
			ClabKind:    "linux",
			DockerImage: "ghcr.io/vivek-dodia/mirror-frr:10.3.1",
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
			DockerImage: "ghcr.io/vivek-dodia/mirror-gobgp:latest",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Nginx (Load Balancer)",
			ClabKind:    "linux",
			DockerImage: "ghcr.io/vivek-dodia/mirror-nginx:alpine",
			DefaultUser: "root",
			DefaultPass: "",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "osvBNG",
			ClabKind:    "linux",
			DockerImage: "ghcr.io/vivek-dodia/mirror-osvbng:latest",
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
			DockerImage: "ghcr.io/vivek-dodia/vrnetlab-routeros:7.20.8",
			DefaultUser: "admin",
			DefaultPass: "admin",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "Nokia SR Linux 24.10.1",
			ClabKind:    "srl",
			DockerImage: "ghcr.io/vivek-dodia/mirror-srlinux:24.10.1",
			DefaultUser: "admin",
			DefaultPass: "NokiaSrl1!",
			IsSystem:    true,
			OrgID:       0,
		},
		{
			UUID:        uuid.New().String(),
			Name:        "SONiC VS",
			ClabKind:    "sonic-vs",
			DockerImage: "ghcr.io/vivek-dodia/mirror-sonic-vs:latest",
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
			if t.Draft {
				continue
			}
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

// SeedGuides creates learning guides for templates that define them.
// Looks up templates by name and upserts guides.
func SeedGuides(db *gorm.DB) {
	for _, col := range collections {
		for _, t := range col.Templates {
			if t.Guide == nil || t.Draft {
				continue
			}

			// Find the template by name
			var tpl tmpl.Template
			if err := db.Where("name = ?", t.Name).First(&tpl).Error; err != nil {
				continue
			}

			// Check if guide already exists
			var count int64
			db.Model(&guide.LabGuide{}).Where("template_id = ?", tpl.ID).Count(&count)
			if count > 0 {
				continue
			}

			stepsJSON, _ := json.Marshal(convertGuideSteps(t.Guide.Steps))
			conceptsJSON, _ := json.Marshal(t.Guide.Concepts)

			g := &guide.LabGuide{
				UUID:          uuid.New().String(),
				TemplateID:    tpl.ID,
				Title:         t.Guide.Title,
				Description:   t.Guide.Description,
				Difficulty:    t.Guide.Difficulty,
				Concepts:      string(conceptsJSON),
				TopologyNotes: t.Guide.TopologyNotes,
				EstimatedTime: t.Guide.EstimatedTime,
				Steps:         string(stepsJSON),
			}

			if err := db.Create(g).Error; err != nil {
				log.Printf("seed: failed to create guide for %q: %v", t.Name, err)
			} else {
				log.Printf("seed: created guide %q for template %q", t.Guide.Title, t.Name)
			}
		}
	}
}

func convertGuideSteps(steps []GuideStep) []guide.GuideStep {
	result := make([]guide.GuideStep, len(steps))
	for i, s := range steps {
		result[i] = guide.GuideStep{
			Title:       s.Title,
			Description: s.Description,
			Hint:        s.Hint,
		}
		if s.Validation != nil {
			v := &guide.StepValidation{
				Node:    s.Validation.Node,
				Command: s.Validation.Command,
				Pattern: s.Validation.Pattern,
			}
			if s.Validation.NosVariants != nil {
				v.NosVariants = make(map[string]guide.NosVariant)
				for k, nv := range s.Validation.NosVariants {
					v.NosVariants[k] = guide.NosVariant{Command: nv.Command, Pattern: nv.Pattern}
				}
			}
			result[i].Validation = v
		}
	}
	return result
}
