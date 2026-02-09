/**
 * ModelSelector - Dropdown for selecting AI model
 */

import React from 'react';
import useAIStore from '../../stores/useAIStore';

const ModelSelector = ({ className = '' }) => {
  const { models, selectedModelId, selectModel, modelsLoading } = useAIStore();

  if (modelsLoading) {
    return (
      <div className={`model-selector ${className}`}>
        <select disabled className="model-select loading">
          <option>Loading models...</option>
        </select>
      </div>
    );
  }

  if (models.length === 0) {
    return (
      <div className={`model-selector ${className}`}>
        <select disabled className="model-select empty">
          <option>No models available</option>
        </select>
      </div>
    );
  }

  // Group models by provider
  const groupedModels = models.reduce((groups, model) => {
    const provider = model.provider || 'other';
    if (!groups[provider]) groups[provider] = [];
    groups[provider].push(model);
    return groups;
  }, {});

  return (
    <div className={`model-selector ${className}`}>
      <select
        value={selectedModelId || ''}
        onChange={(e) => selectModel(e.target.value)}
        className="model-select"
      >
        {Object.entries(groupedModels).map(([provider, providerModels]) => (
          <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
            {providerModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
                {model.isDefault ? ' (Default)' : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};

export default ModelSelector;
