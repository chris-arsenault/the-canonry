import { useState, useMemo } from 'react';
import { computeProfileGeneratorUsage } from './utils';
import ProfileModal from './ProfileModal';

/**
 * ProfileTab - Profile list with modal editing
 */
export default function ProfileTab({
  cultureId,
  cultureConfig,
  onProfilesChange,
  worldSchema,
  onAddTag,
  generators = [],
}) {
  const [editingProfile, setEditingProfile] = useState(null);
  const [isNewProfile, setIsNewProfile] = useState(false);

  const profiles = cultureConfig?.naming?.profiles || [];

  // Compute generator usage for each profile
  const generatorUsage = useMemo(
    () => computeProfileGeneratorUsage(profiles, generators, cultureId),
    [profiles, generators, cultureId]
  );

  const handleCreateProfile = () => {
    const newProfile = {
      id: `${cultureId}_profile_${profiles.length + 1}`,
      strategyGroups: [
        {
          name: 'Default',
          priority: 0,
          conditions: null,
          strategies: [],
        },
      ],
    };
    setEditingProfile(newProfile);
    setIsNewProfile(true);
  };

  const handleEditProfile = (profile) => {
    setEditingProfile(profile);
    setIsNewProfile(false);
  };

  const handleSaveProfile = (updatedProfile, isNew) => {
    let newProfiles;
    if (isNew) {
      newProfiles = [...profiles.filter((p) => p.id !== updatedProfile.id), updatedProfile];
    } else {
      const existingIdx = profiles.findIndex((p) => p.id === editingProfile.id);
      if (existingIdx >= 0) {
        newProfiles = profiles.map((p, i) => (i === existingIdx ? updatedProfile : p));
      } else {
        newProfiles = [...profiles, updatedProfile];
      }
    }
    onProfilesChange(newProfiles);
    // Update local reference for continued editing
    setEditingProfile(updatedProfile);
  };

  const handleDeleteProfile = (profileId) => {
    const newProfiles = profiles.filter((p) => p.id !== profileId);
    onProfilesChange(newProfiles);
  };

  const handleDuplicateProfile = (profile) => {
    // Generate unique ID
    let newId = `${profile.id}_copy`;
    let counter = 1;
    while (profiles.some((p) => p.id === newId)) {
      newId = `${profile.id}_copy${counter++}`;
    }

    // Deep clone the profile with new ID
    const duplicated = {
      ...JSON.parse(JSON.stringify(profile)),
      id: newId,
      isDefault: false, // Don't copy default status
    };

    // Add to profiles and open for editing
    onProfilesChange([...profiles, duplicated]);
    setEditingProfile(duplicated);
    setIsNewProfile(false);
  };

  const handleCloseModal = () => {
    setEditingProfile(null);
    setIsNewProfile(false);
  };

  // Count conditional groups in a profile
  const countConditionalGroups = (profile) => {
    return (profile.strategyGroups || []).filter((g) => g.conditions).length;
  };

  // Count total strategies in a profile
  const countStrategies = (profile) => {
    return (profile.strategyGroups || []).reduce((sum, g) => sum + (g.strategies?.length || 0), 0);
  };

  return (
    <div className="profile-tab-container">
      <div className="tab-header">
        <h3 className="mt-0">Naming Profiles</h3>
        <button className="primary" onClick={handleCreateProfile}>
          + New Profile
        </button>
      </div>

      <p className="text-muted mb-md">
        Profiles define how names are generated. Each profile contains strategy groups that can be
        conditional (based on entity type, prominence, tags) or unconditional (default).
      </p>

      {profiles.length === 0 ? (
        <div className="empty-state-card">
          <p className="mt-0 mb-0">No profiles yet.</p>
          <p className="text-muted mt-sm mb-0">
            Create a profile to define how names are generated for this culture.
          </p>
        </div>
      ) : (
        <div className="profile-cards-grid">
          {profiles.map((profile) => {
            const usage = generatorUsage[profile.id];
            const matchCount = usage?.totalMatches || 0;
            return (
              <div
                key={profile.id}
                className="profile-card-item"
                onClick={() => handleEditProfile(profile)}
              >
                <div className="profile-card-header">
                  <strong className="profile-card-title">{profile.id}</strong>
                  <div className="profile-badges">
                    {profile.isDefault && (
                      <span className="profile-badge default">Default</span>
                    )}
                    {profile.entityKinds?.length > 0 && (
                      <span className="profile-badge kinds" title={profile.entityKinds.join(', ')}>
                        {profile.entityKinds.length} kind{profile.entityKinds.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    {matchCount > 0 && (
                      <span className="generator-match-pill">
                        {matchCount} generator{matchCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
                <div className="profile-card-stats">
                  <span className="profile-stat">
                    <span className="stat-num">{profile.strategyGroups?.length || 0}</span>
                    <span className="stat-label">groups</span>
                  </span>
                  <span className="profile-stat">
                    <span className="stat-num">{countStrategies(profile)}</span>
                    <span className="stat-label">strategies</span>
                  </span>
                  <span className="profile-stat">
                    <span className="stat-num">{countConditionalGroups(profile)}</span>
                    <span className="stat-label">conditional</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Profile Editor Modal */}
      {editingProfile && (
        <ProfileModal
          profile={editingProfile}
          isNew={isNewProfile}
          onSave={handleSaveProfile}
          onClose={handleCloseModal}
          onDelete={handleDeleteProfile}
          onDuplicate={handleDuplicateProfile}
          cultureConfig={cultureConfig}
          worldSchema={worldSchema}
          onAddTag={onAddTag}
          generatorUsage={generatorUsage[editingProfile.id]}
        />
      )}
    </div>
  );
}
