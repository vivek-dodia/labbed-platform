package template

// Loader implements lab.TemplateLoader using the tmpl repository.
type Loader struct {
	repo *TemplateRepository
}

func NewLoader(repo *TemplateRepository) *Loader {
	return &Loader{repo: repo}
}

// GetDefinition returns the YAML definition for a tmpl by UUID.
func (l *Loader) GetDefinition(topoUUID string) (string, error) {
	t, err := l.repo.GetByUUID(topoUUID)
	if err != nil {
		return "", err
	}
	return t.Definition, nil
}

// GetBindFiles returns a map of filePath -> content for a tmpl's bind files.
func (l *Loader) GetBindFiles(topoUUID string) (map[string][]byte, error) {
	t, err := l.repo.GetByUUID(topoUUID)
	if err != nil {
		return nil, err
	}

	files, err := l.repo.GetBindFilesByTemplateID(t.ID)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]byte, len(files))
	for _, f := range files {
		result[f.FilePath] = f.Content
	}
	return result, nil
}

// GetBindFilesForNos returns bind files filtered to universal (NosKind="") plus
// those matching the given NOS kinds. Used at deploy time to send only relevant configs.
func (l *Loader) GetBindFilesForNos(topoUUID string, nosKinds []string) (map[string][]byte, error) {
	t, err := l.repo.GetByUUID(topoUUID)
	if err != nil {
		return nil, err
	}

	files, err := l.repo.GetBindFilesByTemplateID(t.ID)
	if err != nil {
		return nil, err
	}

	kindSet := make(map[string]bool, len(nosKinds))
	for _, k := range nosKinds {
		kindSet[k] = true
	}

	result := make(map[string][]byte)
	for _, f := range files {
		if f.NosKind == "" || kindSet[f.NosKind] {
			result[f.FilePath] = f.Content
		}
	}
	return result, nil
}
