package topology

// Loader implements lab.TopologyLoader using the topology repository.
type Loader struct {
	repo *TopologyRepository
}

func NewLoader(repo *TopologyRepository) *Loader {
	return &Loader{repo: repo}
}

// GetDefinition returns the YAML definition for a topology by UUID.
func (l *Loader) GetDefinition(topoUUID string) (string, error) {
	t, err := l.repo.GetByUUID(topoUUID)
	if err != nil {
		return "", err
	}
	return t.Definition, nil
}

// GetBindFiles returns a map of filePath -> content for a topology's bind files.
func (l *Loader) GetBindFiles(topoUUID string) (map[string][]byte, error) {
	t, err := l.repo.GetByUUID(topoUUID)
	if err != nil {
		return nil, err
	}

	files, err := l.repo.GetBindFilesByTopologyID(t.ID)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]byte, len(files))
	for _, f := range files {
		result[f.FilePath] = f.Content
	}
	return result, nil
}
