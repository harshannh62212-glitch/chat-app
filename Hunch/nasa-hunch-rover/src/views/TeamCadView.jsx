import React from 'react';
import Rover3DViewer from '../components/canvas/Rover3DViewer';
import { webotsSimulation, cadMetadata, teamMembers } from '../data/teamData';
import { 
  Box, 
  Terminal, 
  Users, 
  Layers, 
  Award, 
  Cpu, 
  Gauge, 
  CheckCircle2,
  HardDrive
} from 'lucide-react';

export default function TeamCadView() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-space-900 border border-space-700/80 rounded-xl p-6 relative overflow-hidden">
        <div className="max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded bg-nasa-orange/10 border border-nasa-orange/30 text-nasa-orange text-xs font-mono mb-2">
            <Box className="w-3.5 h-3.5" />
            <span>DIGITAL TWIN & TEAM ARCHITECTURE</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold font-sans text-white">
            Team & CAD / Webots Simulation Showcase
          </h2>
          <p className="text-sm text-slate-300 mt-2 leading-relaxed">
            Prior to physical fabrication, the AER-V2 CHRONOS rover underwent comprehensive kinematic stress testing within the Webots Open-Source Robotics simulator. Explore the interactive 3D assembly and simulation verification metrics below.
          </p>
        </div>
      </div>

      {/* Interactive 3D Rover Viewer */}
      <Rover3DViewer />

      <div className="bg-space-900 border border-space-700/80 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-space-800">
          <div>
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
              AEGIS-V1 Fusion Assembly (3D)
            </h3>
            <p className="text-xs text-slate-400 mt-1 font-sans">
              Canonical digital twin — serve{' '}
              <code className="text-nasa-cyan">nasa-llaso-cad</code> on port 8002 (
              <code className="text-nasa-cyan">python3 serve.py 8002</code>).
            </p>
          </div>
          <a
            href="http://127.0.0.1:8002/rover_solo.html"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono px-3 py-1.5 rounded-lg border border-nasa-orange/40 text-nasa-orange hover:bg-nasa-orange/10"
          >
            Open full screen ↗
          </a>
        </div>
        <iframe
          title="AEGIS-V1 fusion rover 3D model"
          src="http://127.0.0.1:8002/rover_solo.html"
          className="w-full h-[420px] bg-black border-0"
          loading="lazy"
        />
      </div>

      {/* CAD Physical Specifications & Webots Benchmarks Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: CAD Assembly Metadata & Dimensions */}
        <div className="lg:col-span-5 bg-space-900 border border-space-700/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-space-800 font-mono">
            <HardDrive className="w-4 h-4 text-nasa-cyan" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              CAD Model Structural Dimensions
            </h3>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">CAD Software:</span>
              <span className="text-white font-bold">{cadMetadata.software}</span>
            </div>
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">Total Discrete Parts:</span>
              <span className="text-nasa-cyan font-bold">{cadMetadata.componentsCount} Components</span>
            </div>
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">Dry Structural Mass:</span>
              <span className="text-white font-bold">{cadMetadata.dryMass}</span>
            </div>
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">Overall Footprint (L×W×H):</span>
              <span className="text-nasa-orange font-bold">
                {cadMetadata.dimensions.length} × {cadMetadata.dimensions.width} × {cadMetadata.dimensions.height}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">Wheelbase / Track Width:</span>
              <span className="text-white font-bold">
                {cadMetadata.dimensions.wheelbase} / {cadMetadata.dimensions.trackWidth}
              </span>
            </div>
            <div className="flex justify-between p-2 bg-space-950 rounded border border-space-800">
              <span className="text-slate-400">Wheel Lug Diameter:</span>
              <span className="text-white font-bold">{cadMetadata.dimensions.wheelDiameter} (High-Traction TPU)</span>
            </div>
          </div>

          <div className="p-3 bg-space-950 rounded-lg border border-space-800 font-mono text-[11px] text-slate-400">
            <div className="text-slate-300 font-bold uppercase mb-1">Center of Gravity Vector:</div>
            <div>{cadMetadata.centerOfMass}</div>
            <div className="text-nasa-green mt-1">✓ Pitch stability margin verified up to 34° incline.</div>
          </div>
        </div>

        {/* Right: Webots Physics Simulation Performance */}
        <div className="lg:col-span-7 bg-space-900 border border-space-700/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-space-800 font-mono">
            <Terminal className="w-4 h-4 text-nasa-orange" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Webots ODE Simulation Performance
            </h3>
          </div>

          <p className="text-xs text-slate-300 font-mono">
            Simulation Engine: <strong className="text-white">{webotsSimulation.engine}</strong> ({webotsSimulation.timestep})
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {webotsSimulation.benchmarks.map((bench, idx) => (
              <div key={idx} className="bg-space-950 p-3 rounded-lg border border-space-800 font-mono text-xs">
                <div className="text-slate-400 text-[10px] uppercase mb-1">{bench.metric}</div>
                <div className="text-nasa-cyan font-bold">{bench.rate}</div>
              </div>
            ))}
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-mono font-bold text-slate-300 uppercase">
              Tested Planetary Surface Formations:
            </div>
            {webotsSimulation.terrainTypes.map((t, idx) => (
              <div key={idx} className="p-2.5 bg-space-950 rounded border border-space-800 flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-medium">{t.name}</span>
                <span className="text-nasa-green">
                  {t.slipRatio ? `Slip: ${t.slipRatio}` : t.successRate ? `Success: ${t.successRate}` : t.sustainedSpeed}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engineering Team Breakdown */}
      <div className="bg-space-900 border border-space-700/80 rounded-xl p-6">
        <div className="flex items-center space-x-2 pb-4 border-b border-space-800 font-mono mb-4">
          <Users className="w-4 h-4 text-nasa-cyan" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            NASA HUNCH Team Role Distribution & Specializations
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {teamMembers.map((member, idx) => (
            <div key={idx} className="bg-space-950 border border-space-800 rounded-lg p-4 font-mono">
              <div className="text-xs font-bold text-nasa-orange mb-1">
                {member.role}
              </div>
              <p className="text-xs text-slate-300 mb-3 font-sans leading-relaxed">
                {member.focus}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-space-800">
                {member.badges.map((b, i) => (
                  <span key={i} className="text-[10px] bg-space-900 text-slate-400 px-2 py-0.5 rounded border border-space-700">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
