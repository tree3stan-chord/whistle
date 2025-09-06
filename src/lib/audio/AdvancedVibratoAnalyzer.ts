/**
 * Advanced Vibrato Analysis System
 * Sophisticated detection and classification of vibrato patterns in vocal performance
 * Goes beyond basic rate/depth to analyze vibrato quality, onset, and musical context
 */

interface DetectionConfig {
  minDepth: number;
  maxDepth: number;
  minRate: number;
  maxRate: number;
  minDuration: number;
  consistencyThreshold: number;
}

interface ClassificationConfig {
  narrow: { depthRange: [number, number] };
  moderate: { depthRange: [number, number] };
  wide: { depthRange: [number, number] };
  slow: { rateRange: [number, number] };
  moderate_rate: { rateRange: [number, number] };
  fast: { rateRange: [number, number] };
  immediate: { onsetDelay: [number, number] };
  delayed: { onsetDelay: [number, number] };
  gradual: { onsetDelay: [number, number] };
}

interface AdvancedConfig {
  waveformAnalysis: boolean;
  symmetryAnalysis: boolean;
  modulationTracking: boolean;
  contextualAnalysis: boolean;
  breathCouplingDetection: boolean;
}

interface AnalysisConfig {
  detection: DetectionConfig;
  classification: ClassificationConfig;
  advanced: AdvancedConfig;
}

interface VibratoModel {
  rateRange: [number, number];
  depthRange: [number, number];
  consistency: [number, number];
  symmetry: [number, number];
  onsetControl: [number, number];
}

interface VibratoCandidate {
  startTime: number;
  endTime?: number;
  duration: number;
  frames: any[];
  pitchPoints: number[];
  timestamps: number[];
}

interface RateAnalysis {
  primaryRate: number;
  variability: number;
  stability: number;
  methods?: {
    zeroCrossing: number;
    autocorrelation: number;
    fft: number;
  };
}

interface DepthAnalysis {
  averageDepth: number;
  variability: number;
  profile: Array<{
    timestamp: number;
    depth: number;
    relativeMagnitude: number;
  }>;
  statistics: {
    min: number;
    max: number;
    median: number;
  };
}

interface OnsetAnalysis {
  delay: number;
  type: 'immediate' | 'delayed' | 'gradual';
  gradualness: number;
  control: number;
}

interface WaveformAnalysis {
  shape: 'sinusoidal' | 'triangular' | 'irregular' | 'mixed' | 'insufficient_data';
  characteristics: {
    smoothness: number;
    peakSharpness: number;
    asymmetry: number;
    harmonics: any[];
  };
}

interface VibratoClassification {
  type: string;
  quality: string;
  confidence: number;
  characteristics: string[];
}

interface VibratoQuality {
  overall: number;
  technical: {
    rate: number;
    depth: number;
    consistency: number;
    symmetry: number;
  };
  musical: {
    control: number;
    expression: number;
    appropriateness: number;
  };
  recommendations: any[];
}

interface VibratoSegmentAnalysis {
  startTime: number;
  endTime: number;
  duration: number;
  isValidVibrato: boolean;
  rate: number;
  depth: number;
  consistency: number;
  symmetry: number;
  onset: OnsetAnalysis;
  waveform: WaveformAnalysis;
  quality: VibratoQuality;
  classification: VibratoClassification | null;
  rateVariability?: number;
  rateStability?: number;
  depthVariability?: number;
  depthProfile?: any;
}

interface ForensicFrame {
  timestamp: number;
  vibrato?: {
    present: boolean;
    depth?: number;
  };
  pitch: {
    fundamental: number;
  };
}

interface ForensicData {
  analysis?: ForensicFrame[];
}

export class AdvancedVibratoAnalyzer {
  private analysisConfig: AnalysisConfig;
  private vibratoModels: Record<string, VibratoModel>;
  private analysisHistory: any[];
  private currentVibratoState: any;
  private vibratoSegments: any[];

  constructor() {
    // Vibrato analysis parameters
    this.analysisConfig = {
      // Detection thresholds
      detection: {
        minDepth: 8, // cents - minimum depth to consider vibrato
        maxDepth: 150, // cents - maximum reasonable vibrato depth
        minRate: 3.5, // Hz - minimum rate for vibrato
        maxRate: 8.5, // Hz - maximum rate for vibrato
        minDuration: 0.3, // seconds - minimum sustained time for vibrato
        consistencyThreshold: 0.6 // consistency required across time
      },
      
      // Classification parameters
      classification: {
        // Vibrato quality descriptors
        narrow: { depthRange: [8, 25] }, // cents
        moderate: { depthRange: [25, 60] },
        wide: { depthRange: [60, 150] },
        
        slow: { rateRange: [3.5, 5.0] }, // Hz
        moderate_rate: { rateRange: [5.0, 6.5] },
        fast: { rateRange: [6.5, 8.5] },
        
        // Onset characteristics
        immediate: { onsetDelay: [0, 0.1] }, // seconds
        delayed: { onsetDelay: [0.1, 0.5] },
        gradual: { onsetDelay: [0.5, 2.0] }
      },
      
      // Advanced analysis parameters
      advanced: {
        waveformAnalysis: true,
        symmetryAnalysis: true,
        modulationTracking: true,
        contextualAnalysis: true,
        breathCouplingDetection: true
      }
    };
    
    // Vibrato quality models based on classical vocal technique
    this.vibratoModels = {
      // Professional vibrato characteristics
      professional: {
        rateRange: [5.5, 7.0],
        depthRange: [30, 80],
        consistency: [0.8, 1.0],
        symmetry: [0.7, 1.0],
        onsetControl: [0.6, 1.0]
      },
      
      // Student/developing vibrato
      developing: {
        rateRange: [4.0, 8.0],
        depthRange: [15, 120],
        consistency: [0.4, 0.8],
        symmetry: [0.4, 0.8],
        onsetControl: [0.2, 0.7]
      },
      
      // Natural/untrained vibrato
      natural: {
        rateRange: [4.5, 7.5],
        depthRange: [20, 100],
        consistency: [0.3, 0.7],
        symmetry: [0.3, 0.7],
        onsetControl: [0.1, 0.5]
      },
      
      // Tremolo (often confused with vibrato)
      tremolo: {
        rateRange: [8.5, 15.0],
        depthRange: [10, 60],
        consistency: [0.6, 0.9],
        symmetry: [0.5, 0.8],
        onsetControl: [0.3, 0.8]
      }
    };
    
    // Analysis state
    this.analysisHistory = [];
    this.currentVibratoState = null;
    this.vibratoSegments = [];
  }

  async analyzeVibratoInDepth(
    forensicData: ForensicData, 
    pitchTrajectory: any[], 
    timeWindow?: { start: number; end: number }
  ): Promise<any> {
    console.log('Performing advanced vibrato analysis...');
    
    // Extract vibrato candidates from forensic data
    const vibratoCandidates = this.extractVibratoCandidates(forensicData, timeWindow);
    
    if (vibratoCandidates.length === 0) {
      return this.createNoVibratoResult();
    }
    
    const analysisResults: VibratoSegmentAnalysis[] = [];
    
    for (const candidate of vibratoCandidates) {
      // Detailed analysis of each vibrato segment
      const detailedAnalysis = await this.analyzeVibratoSegment(candidate, pitchTrajectory);
      
      if (detailedAnalysis.isValidVibrato) {
        analysisResults.push(detailedAnalysis);
      }
    }
    
    // Combine results and generate comprehensive vibrato profile
    return this.generateVibratoProfile(analysisResults, forensicData);
  }

  private extractVibratoCandidates(forensicData: ForensicData, timeWindow?: { start: number; end: number }): VibratoCandidate[] {
    const candidates: VibratoCandidate[] = [];
    let currentCandidate: VibratoCandidate | null = null;
    
    if (!forensicData || !forensicData.analysis) {
      return candidates;
    }
    
    const relevantFrames = timeWindow ? 
      forensicData.analysis.filter(frame => 
        frame.timestamp >= timeWindow.start && frame.timestamp <= timeWindow.end
      ) : forensicData.analysis;
    
    relevantFrames.forEach((frame) => {
      if (frame.vibrato && frame.vibrato.present) {
        if (!currentCandidate) {
          // Start new vibrato candidate
          currentCandidate = {
            startTime: frame.timestamp,
            frames: [frame],
            pitchPoints: [frame.pitch.fundamental],
            timestamps: [frame.timestamp],
            duration: 0
          };
        } else {
          // Continue existing candidate
          currentCandidate.frames.push(frame);
          currentCandidate.pitchPoints.push(frame.pitch.fundamental);
          currentCandidate.timestamps.push(frame.timestamp);
          currentCandidate.endTime = frame.timestamp;
        }
      } else if (currentCandidate) {
        // End current candidate
        currentCandidate.duration = (currentCandidate.endTime || currentCandidate.startTime) - currentCandidate.startTime;
        
        if (currentCandidate.duration >= this.analysisConfig.detection.minDuration) {
          candidates.push(currentCandidate);
        }
        currentCandidate = null;
      }
    });
    
    // Handle final candidate
    if (currentCandidate) {
      currentCandidate.endTime = currentCandidate.timestamps[currentCandidate.timestamps.length - 1];
      currentCandidate.duration = currentCandidate.endTime - currentCandidate.startTime;
      
      if (currentCandidate.duration >= this.analysisConfig.detection.minDuration) {
        candidates.push(currentCandidate);
      }
    }
    
    return candidates;
  }

  private async analyzeVibratoSegment(candidate: VibratoCandidate, pitchTrajectory: any[]): Promise<VibratoSegmentAnalysis> {
    const analysis: VibratoSegmentAnalysis = {
      startTime: candidate.startTime,
      endTime: candidate.endTime || candidate.startTime,
      duration: candidate.duration,
      isValidVibrato: false,
      rate: 0,
      depth: 0,
      consistency: 0,
      symmetry: 0,
      onset: {} as OnsetAnalysis,
      waveform: {} as WaveformAnalysis,
      quality: {} as VibratoQuality,
      classification: null
    };
    
    // 1. Rate Analysis - More sophisticated than basic frequency counting
    const rateAnalysis = this.analyzeVibratoRate(candidate);
    analysis.rate = rateAnalysis.primaryRate;
    analysis.rateVariability = rateAnalysis.variability;
    analysis.rateStability = rateAnalysis.stability;
    
    // 2. Depth Analysis - Peak-to-peak and RMS depth
    const depthAnalysis = this.analyzeVibratoDepth(candidate);
    analysis.depth = depthAnalysis.averageDepth;
    analysis.depthVariability = depthAnalysis.variability;
    analysis.depthProfile = depthAnalysis.profile;
    
    // 3. Consistency Analysis - How regular is the vibrato?
    analysis.consistency = this.analyzeVibratoConsistency(candidate);
    
    // 4. Symmetry Analysis - Is the vibrato balanced above/below center pitch?
    analysis.symmetry = this.analyzeVibratoSymmetry(candidate);
    
    // 5. Onset Analysis - How does the vibrato begin?
    analysis.onset = this.analyzeVibratoOnset(candidate, pitchTrajectory);
    
    // 6. Waveform Analysis - Shape characteristics
    if (this.analysisConfig.advanced.waveformAnalysis) {
      analysis.waveform = this.analyzeVibratoWaveform(candidate);
    }
    
    // 7. Validate as true vibrato
    analysis.isValidVibrato = this.validateVibrato(analysis);
    
    if (analysis.isValidVibrato) {
      // 8. Classify vibrato quality and type
      analysis.classification = this.classifyVibrato(analysis);
      analysis.quality = this.assessVibratoQuality(analysis);
    }
    
    return analysis;
  }

  private analyzeVibratoRate(candidate: VibratoCandidate): RateAnalysis {
    // Advanced rate analysis using multiple methods
    const pitchPoints = candidate.pitchPoints;
    const timestamps = candidate.timestamps;
    const duration = candidate.duration;
    
    if (pitchPoints.length < 10) {
      return { primaryRate: 0, variability: 0, stability: 0 };
    }
    
    // Method 1: Zero-crossing analysis
    const zeroCrossings = this.findZeroCrossings(pitchPoints, timestamps);
    const zeroCrossingRate = zeroCrossings.length / (2 * duration); // Half-cycles to full cycles
    
    // Method 2: Autocorrelation analysis
    const autocorrRate = this.calculateAutocorrelationRate(pitchPoints, timestamps);
    
    // Method 3: FFT-based periodicity detection
    const fftRate = this.calculateFFTBasedRate(pitchPoints, timestamps);
    
    // Combine methods with weighted average
    const rates = [zeroCrossingRate, autocorrRate, fftRate].filter(r => r > 0);
    const primaryRate = rates.length > 0 ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;
    
    // Calculate rate variability over time
    const rateVariability = this.calculateRateVariability(candidate);
    
    // Rate stability (consistency over the vibrato duration)
    const rateStability = primaryRate > 0 ? Math.max(0, 1 - (rateVariability / primaryRate)) : 0;
    
    return {
      primaryRate,
      variability: rateVariability,
      stability: rateStability,
      methods: {
        zeroCrossing: zeroCrossingRate,
        autocorrelation: autocorrRate,
        fft: fftRate
      }
    };
  }

  private analyzeVibratoDepth(candidate: VibratoCandidate): DepthAnalysis {
    const pitchPoints = candidate.pitchPoints;
    if (pitchPoints.length === 0) {
      return { 
        averageDepth: 0, 
        variability: 0, 
        profile: [],
        statistics: { min: 0, max: 0, median: 0 }
      };
    }
    
    const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
    
    // Calculate instantaneous depths (peak-to-peak in sliding windows)
    const windowSize = Math.max(3, Math.floor(pitchPoints.length / 10));
    const depths: number[] = [];
    
    for (let i = 0; i <= pitchPoints.length - windowSize; i++) {
      const window = pitchPoints.slice(i, i + windowSize);
      const min = Math.min(...window);
      const max = Math.max(...window);
      const depth = this.frequencyToCents(max, min); // Convert to cents
      depths.push(depth);
    }
    
    // Calculate depth statistics
    const averageDepth = depths.reduce((sum, d) => sum + d, 0) / depths.length;
    const depthVariability = this.calculateVariance(depths);
    
    // Create depth profile over time
    const profile = depths.map((depth, index) => ({
      timestamp: candidate.timestamps[index],
      depth,
      relativeMagnitude: depth / averageDepth
    }));
    
    return {
      averageDepth,
      variability: Math.sqrt(depthVariability),
      profile,
      statistics: {
        min: Math.min(...depths),
        max: Math.max(...depths),
        median: this.calculateMedian(depths)
      }
    };
  }

  private analyzeVibratoConsistency(candidate: VibratoCandidate): number {
    // Measure how regular/consistent the vibrato is
    const pitchPoints = candidate.pitchPoints;
    const timestamps = candidate.timestamps;
    
    if (pitchPoints.length < 10) return 0;
    
    // Find cycles in the vibrato
    const cycles = this.extractVibratoCycles(pitchPoints, timestamps);
    
    if (cycles.length < 2) return 0;
    
    // Calculate consistency metrics
    const cycleLengths = cycles.map(cycle => cycle.duration);
    const cycleAmplitudes = cycles.map(cycle => cycle.amplitude);
    
    // Coefficient of variation (lower = more consistent)
    const lengthCV = this.calculateCV(cycleLengths);
    const amplitudeCV = this.calculateCV(cycleAmplitudes);
    
    // Consistency score (0-1, higher = more consistent)
    const lengthConsistency = Math.max(0, 1 - lengthCV);
    const amplitudeConsistency = Math.max(0, 1 - amplitudeCV);
    
    return (lengthConsistency + amplitudeConsistency) / 2;
  }

  private analyzeVibratoSymmetry(candidate: VibratoCandidate): number {
    // Analyze whether vibrato is symmetric around the center pitch
    const pitchPoints = candidate.pitchPoints;
    const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
    
    const deviations = pitchPoints.map(p => p - meanPitch);
    const positiveDeviations = deviations.filter(d => d > 0);
    const negativeDeviations = deviations.filter(d => d < 0).map(d => Math.abs(d));
    
    if (positiveDeviations.length === 0 || negativeDeviations.length === 0) {
      return 0; // No symmetry if vibrato only goes in one direction
    }
    
    const avgPositive = positiveDeviations.reduce((sum, d) => sum + d, 0) / positiveDeviations.length;
    const avgNegative = negativeDeviations.reduce((sum, d) => sum + d, 0) / negativeDeviations.length;
    
    // Symmetry score (1 = perfect symmetry, 0 = completely asymmetric)
    const symmetryRatio = Math.min(avgPositive, avgNegative) / Math.max(avgPositive, avgNegative);
    
    return symmetryRatio;
  }

  private analyzeVibratoOnset(candidate: VibratoCandidate, pitchTrajectory: any[]): OnsetAnalysis {
    // Analyze how the vibrato begins
    const onsetAnalysis: OnsetAnalysis = {
      delay: 0,
      type: 'immediate',
      gradualness: 0,
      control: 0
    };
    
    // Find the note start before this vibrato
    const vibratoStart = candidate.startTime;
    let noteStartTime = vibratoStart;
    
    if (pitchTrajectory) {
      // Look for the beginning of the sustained note
      const relevantTrajectory = pitchTrajectory.filter(point => point.timestamp <= vibratoStart);
      
      if (relevantTrajectory.length > 0) {
        // Find where pitch stabilizes before vibrato
        for (let i = relevantTrajectory.length - 1; i >= 0; i--) {
          const point = relevantTrajectory[i];
          if (Math.abs(point.frequency - candidate.pitchPoints[0]) > 50) { // 50 cents difference
            noteStartTime = i < relevantTrajectory.length - 1 ? relevantTrajectory[i + 1].timestamp : vibratoStart;
            break;
          }
        }
      }
    }
    
    onsetAnalysis.delay = vibratoStart - noteStartTime;
    
    // Classify onset type
    if (onsetAnalysis.delay < 0.1) {
      onsetAnalysis.type = 'immediate';
    } else if (onsetAnalysis.delay < 0.5) {
      onsetAnalysis.type = 'delayed';
    } else {
      onsetAnalysis.type = 'gradual';
    }
    
    // Analyze gradualness - how smoothly does vibrato develop?
    if (candidate.frames.length > 5) {
      const earlyFrames = candidate.frames.slice(0, Math.min(5, candidate.frames.length));
      const vibratoDepths = earlyFrames.map(frame => frame.vibrato?.depth || 0);
      
      // Check if vibrato grows gradually
      let isGradual = true;
      for (let i = 1; i < vibratoDepths.length; i++) {
        if (vibratoDepths[i] < vibratoDepths[i - 1]) {
          isGradual = false;
          break;
        }
      }
      
      onsetAnalysis.gradualness = isGradual ? 1 : 0.5;
    }
    
    // Control assessment (smoother onset = better control)
    onsetAnalysis.control = onsetAnalysis.gradualness * (onsetAnalysis.delay > 0.1 ? 1 : 0.7);
    
    return onsetAnalysis;
  }

  private analyzeVibratoWaveform(candidate: VibratoCandidate): WaveformAnalysis {
    // Analyze the shape characteristics of the vibrato waveform
    const pitchPoints = candidate.pitchPoints;
    
    if (pitchPoints.length < 10) {
      return { 
        shape: 'insufficient_data', 
        characteristics: {
          smoothness: 0,
          peakSharpness: 0,
          asymmetry: 0,
          harmonics: []
        }
      };
    }
    
    const waveformAnalysis: WaveformAnalysis = {
      shape: 'sinusoidal', // Default assumption
      characteristics: {
        smoothness: 0,
        peakSharpness: 0,
        asymmetry: 0,
        harmonics: []
      }
    };
    
    // Detrend and normalize
    const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
    const detrended = pitchPoints.map(p => p - meanPitch);
    const maxAbs = Math.max(...detrended.map(Math.abs));
    const normalized = detrended.map(d => d / maxAbs);
    
    // Analyze smoothness (low high-frequency content = smoother)
    waveformAnalysis.characteristics.smoothness = this.calculateSmoothness(normalized);
    
    // Analyze peak sharpness
    waveformAnalysis.characteristics.peakSharpness = this.calculatePeakSharpness(normalized);
    
    // Classify waveform shape
    if (waveformAnalysis.characteristics.smoothness > 0.8) {
      waveformAnalysis.shape = 'sinusoidal';
    } else if (waveformAnalysis.characteristics.peakSharpness > 0.7) {
      waveformAnalysis.shape = 'triangular';
    } else if (waveformAnalysis.characteristics.smoothness < 0.3) {
      waveformAnalysis.shape = 'irregular';
    } else {
      waveformAnalysis.shape = 'mixed';
    }
    
    return waveformAnalysis;
  }

  private validateVibrato(analysis: VibratoSegmentAnalysis): boolean {
    // Validate that this is actually vibrato, not tremolo or other artifacts
    const config = this.analysisConfig.detection;
    
    // Check basic requirements
    if (analysis.rate < config.minRate || analysis.rate > config.maxRate) {
      return false;
    }
    
    if (analysis.depth < config.minDepth || analysis.depth > config.maxDepth) {
      return false;
    }
    
    if (analysis.consistency < config.consistencyThreshold) {
      return false;
    }
    
    if (analysis.duration < config.minDuration) {
      return false;
    }
    
    // Additional validation criteria
    if (analysis.symmetry < 0.3) {
      return false; // Too asymmetric
    }
    
    return true;
  }

  private classifyVibrato(analysis: VibratoSegmentAnalysis): VibratoClassification {
    // Classify vibrato type and quality
    const classification: VibratoClassification = {
      type: 'unknown',
      quality: 'developing',
      confidence: 0,
      characteristics: []
    };
    
    // Rate classification
    const rateClassification = this.classifyByRate(analysis.rate);
    const depthClassification = this.classifyByDepth(analysis.depth);
    
    classification.characteristics.push(rateClassification, depthClassification);
    
    // Quality assessment based on multiple factors
    let qualityScore = 0;
    
    // Rate quality (ideal range 5.5-7.0 Hz)
    if (analysis.rate >= 5.5 && analysis.rate <= 7.0) {
      qualityScore += 0.3;
    } else if (analysis.rate >= 4.5 && analysis.rate <= 8.0) {
      qualityScore += 0.2;
    } else {
      qualityScore += 0.1;
    }
    
    // Depth quality (ideal range 30-80 cents)
    if (analysis.depth >= 30 && analysis.depth <= 80) {
      qualityScore += 0.25;
    } else if (analysis.depth >= 20 && analysis.depth <= 100) {
      qualityScore += 0.15;
    } else {
      qualityScore += 0.05;
    }
    
    // Consistency quality
    qualityScore += analysis.consistency * 0.25;
    
    // Symmetry quality
    qualityScore += analysis.symmetry * 0.1;
    
    // Control quality (onset characteristics)
    qualityScore += analysis.onset.control * 0.1;
    
    // Classify quality level
    if (qualityScore >= 0.8) {
      classification.quality = 'professional';
    } else if (qualityScore >= 0.6) {
      classification.quality = 'advanced';
    } else if (qualityScore >= 0.4) {
      classification.quality = 'intermediate';
    } else if (qualityScore >= 0.2) {
      classification.quality = 'developing';
    } else {
      classification.quality = 'basic';
    }
    
    classification.confidence = qualityScore;
    
    // Type classification (professional, developing, etc.)
    classification.type = this.determineVibratoType(analysis);
    
    return classification;
  }

  private assessVibratoQuality(analysis: VibratoSegmentAnalysis): VibratoQuality {
    // Comprehensive quality assessment
    return {
      overall: analysis.classification?.confidence || 0,
      technical: {
        rate: this.assessRateQuality(analysis.rate),
        depth: this.assessDepthQuality(analysis.depth),
        consistency: analysis.consistency,
        symmetry: analysis.symmetry
      },
      musical: {
        control: analysis.onset.control,
        expression: this.calculateExpressiveValue(analysis),
        appropriateness: this.assessContextualFit(analysis)
      },
      recommendations: this.generateRecommendations(analysis)
    };
  }

  // Utility methods

  private frequencyToCents(freq1: number, freq2: number): number {
    if (freq1 <= 0 || freq2 <= 0) return 0;
    return 1200 * Math.log2(Math.max(freq1, freq2) / Math.min(freq1, freq2));
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateCV(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = this.calculateVariance(values);
    return mean > 0 ? Math.sqrt(variance) / mean : 0;
  }

  private findZeroCrossings(pitchPoints: number[], timestamps: number[]): Array<{
    index: number;
    timestamp: number;
    direction: 'rising' | 'falling';
  }> {
    const meanPitch = pitchPoints.reduce((sum, p) => sum + p, 0) / pitchPoints.length;
    const deviations = pitchPoints.map(p => p - meanPitch);
    
    const crossings = [];
    for (let i = 1; i < deviations.length; i++) {
      if ((deviations[i - 1] >= 0) !== (deviations[i] >= 0)) {
        crossings.push({
          index: i,
          timestamp: timestamps[i],
          direction: deviations[i] > deviations[i - 1] ? 'rising' as const : 'falling' as const
        });
      }
    }
    
    return crossings;
  }

  private calculateAutocorrelationRate(pitchPoints: number[], timestamps: number[]): number {
    // Simplified autocorrelation - would need full implementation
    return 0; // Placeholder
  }

  private calculateFFTBasedRate(pitchPoints: number[], timestamps: number[]): number {
    // Simplified FFT analysis - would need full implementation
    return 0; // Placeholder
  }

  private calculateRateVariability(candidate: VibratoCandidate): number {
    // Calculate how much the rate varies over time
    return 0.1; // Placeholder
  }

  private extractVibratoCycles(pitchPoints: number[], timestamps: number[]): Array<{
    start: any;
    end: any;
    duration: number;
    amplitude: number;
    pitchPoints: number[];
  }> {
    // Extract individual vibrato cycles
    return []; // Placeholder
  }

  private calculateSmoothness(normalized: number[]): number {
    // Calculate waveform smoothness
    return 0.8; // Placeholder
  }

  private calculatePeakSharpness(normalized: number[]): number {
    // Calculate peak sharpness
    return 0.3; // Placeholder
  }

  private classifyByRate(rate: number): string {
    if (rate < 5.0) return 'slow';
    if (rate <= 6.5) return 'moderate';
    if (rate <= 8.5) return 'fast';
    return 'very_fast';
  }

  private classifyByDepth(depth: number): string {
    if (depth < 25) return 'narrow';
    if (depth <= 60) return 'moderate';
    if (depth <= 100) return 'wide';
    return 'very_wide';
  }

  private determineVibratoType(analysis: VibratoSegmentAnalysis): string {
    // Match against vibrato models
    let bestMatch = 'natural';
    let bestScore = -1;
    
    for (const [type, model] of Object.entries(this.vibratoModels)) {
      let score = 0;
      let criteria = 0;
      
      // Rate matching
      if (analysis.rate >= model.rateRange[0] && analysis.rate <= model.rateRange[1]) {
        score += 1;
      }
      criteria += 1;
      
      // Depth matching
      if (analysis.depth >= model.depthRange[0] && analysis.depth <= model.depthRange[1]) {
        score += 1;
      }
      criteria += 1;
      
      // Consistency matching
      if (analysis.consistency >= model.consistency[0] && analysis.consistency <= model.consistency[1]) {
        score += 1;
      }
      criteria += 1;
      
      // Symmetry matching
      if (analysis.symmetry >= model.symmetry[0] && analysis.symmetry <= model.symmetry[1]) {
        score += 1;
      }
      criteria += 1;
      
      // Onset control matching
      if (analysis.onset.control >= model.onsetControl[0] && analysis.onset.control <= model.onsetControl[1]) {
        score += 1;
      }
      criteria += 1;
      
      const normalizedScore = score / criteria;
      if (normalizedScore > bestScore) {
        bestScore = normalizedScore;
        bestMatch = type;
      }
    }
    
    return bestMatch;
  }

  private assessRateQuality(rate: number): number {
    if (rate >= 5.5 && rate <= 7.0) return 1.0;
    if (rate >= 5.0 && rate <= 8.0) return 0.8;
    if (rate >= 4.0 && rate <= 8.5) return 0.6;
    return 0.3;
  }

  private assessDepthQuality(depth: number): number {
    if (depth >= 30 && depth <= 80) return 1.0;
    if (depth >= 20 && depth <= 100) return 0.8;
    if (depth >= 15 && depth <= 120) return 0.6;
    return 0.3;
  }

  private calculateExpressiveValue(analysis: VibratoSegmentAnalysis): number {
    // Calculate musical expressiveness
    return 0.7; // Placeholder
  }

  private assessContextualFit(analysis: VibratoSegmentAnalysis): number {
    // Assess how well vibrato fits musical context
    return 0.8; // Placeholder
  }

  private generateRecommendations(analysis: VibratoSegmentAnalysis): any[] {
    const recommendations = [];
    
    if (analysis.rate < 5.0) {
      recommendations.push({
        type: 'rate',
        message: 'Try to increase vibrato rate slightly for more energy',
        priority: 'medium'
      });
    }
    
    if (analysis.depth < 20) {
      recommendations.push({
        type: 'depth',
        message: 'Vibrato depth could be increased for more expression',
        priority: 'low'
      });
    }
    
    return recommendations;
  }

  private createNoVibratoResult(): any {
    return {
      vibratoDetected: false,
      message: 'No vibrato detected in the analyzed audio',
      timestamp: Date.now()
    };
  }

  private generateVibratoProfile(analysisResults: VibratoSegmentAnalysis[], forensicData: ForensicData): any {
    return {
      vibratoDetected: true,
      segmentCount: analysisResults.length,
      segments: analysisResults,
      overallQuality: analysisResults.length > 0 ? 
        analysisResults.reduce((sum, seg) => sum + seg.quality.overall, 0) / analysisResults.length : 0,
      timestamp: Date.now()
    };
  }
}