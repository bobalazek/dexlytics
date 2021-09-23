export default interface PlatformBlockInterface {
  number: number;
  hash: string;
  timestamp: number; // unix seconds, NOT milliseconds!
  difficulty: number;
  gasLimit: string;
  gasUsed: string;
}
