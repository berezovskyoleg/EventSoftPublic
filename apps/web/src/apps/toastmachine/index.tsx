import { LicenseGate } from "../../components/license-gate";
import { SlotMachine } from "./slot-machine";

function ToastMachineLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <defs>
        <linearGradient id="tm-logo-web" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#d97706" />
        </linearGradient>
      </defs>
      <path
        d="M5 4c0 6 4 10 7 10s7-4 7-10M5 4h14M12 14v6M8 20h8"
        stroke="url(#tm-logo-web)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ToastMachineWeb() {
  return (
    <LicenseGate app="toastmachine" title="ToastMachine" logo={<ToastMachineLogo className="h-10 w-10" />}>
      <SlotMachine />
    </LicenseGate>
  );
}
