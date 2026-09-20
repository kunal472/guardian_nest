import { speakerBiometricsService } from '../../src/services/speakerBiometricsService';

describe('SpeakerBiometricsService Unit Tests', () => {
  beforeEach(() => {
    speakerBiometricsService.resetProfile();
    speakerBiometricsService.setMatchThreshold(0.72);
  });

  it('should initialize with default enrolled profile or allow enrolment verification', () => {
    const profile = speakerBiometricsService.getProfile();
    expect(profile).toBeDefined();
    expect(speakerBiometricsService.isEnrolled()).toBe(true);
    expect(profile?.embeddingVector).toHaveLength(16);
  });

  it('should compute valid 16-dimensional embedding from audio samples', () => {
    const mockAudioSamples = new Float32Array(1600);
    for (let i = 0; i < 1600; i++) {
      mockAudioSamples[i] = Math.sin(i * 0.1) * 0.5;
    }

    const embedding = speakerBiometricsService.extractEmbedding(mockAudioSamples);
    expect(embedding).toHaveLength(16);
    embedding.forEach((val) => {
      expect(typeof val).toBe('number');
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1.0);
    });
  });

  it('should authenticate owner voice vector with high cosine similarity', () => {
    const profile = speakerBiometricsService.getProfile();
    expect(profile).not.null;

    // Test with the exact profile embedding
    const verification = speakerBiometricsService.verifySpeaker(profile!.embeddingVector);
    expect(verification.isMatch).toBe(true);
    expect(verification.similarity).toBeGreaterThanOrEqual(0.99);
    expect(verification.isEnrolled).toBe(true);
  });

  it('should reject dissimilar bystander voice vector', () => {
    // Orthogonal / dissimilar mock feature vector (distinct spectral centroid)
    const bystanderVector = [
      0.9, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    ];

    const verification = speakerBiometricsService.verifySpeaker(bystanderVector);
    expect(verification.isMatch).toBe(false);
    expect(verification.similarity).toBeLessThan(0.72);
  });

  it('should allow dynamic tuning of match threshold', () => {
    speakerBiometricsService.setMatchThreshold(0.85);
    expect(speakerBiometricsService.getMatchThreshold()).toBe(0.85);

    speakerBiometricsService.setMatchThreshold(0.50);
    expect(speakerBiometricsService.getMatchThreshold()).toBe(0.50);
  });

  it('should support multi-sample calibration and voice enrollment', () => {
    const sample1 = new Array(16).fill(0.4);
    const sample2 = new Array(16).fill(0.45);
    const sample3 = new Array(16).fill(0.42);

    const enrolled = speakerBiometricsService.enrollVoice('user_test_99', 'Jane Citizen', [
      sample1,
      sample2,
      sample3,
    ]);

    expect(enrolled.userId).toBe('user_test_99');
    expect(enrolled.userName).toBe('Jane Citizen');
    expect(enrolled.samplesCount).toBe(3);
    expect(enrolled.embeddingVector).toHaveLength(16);
  });
});
