declare module 'osrm-text-instructions' {
  export type RouteStep = {
    maneuver: { type: string; modifier?: string };
    name?: string;
    distance?: number;
    duration?: number;
  };

  export type CompileOptions = {
    legCount?: number;
    legIndex?: number;
    formatToken?: (token: string, value: string) => string;
  };

  export interface Compiler {
    compile: (language: string, step: RouteStep, options?: CompileOptions) => string;
  }

  export default function osrmTextInstructions(version: string): Compiler;
}
