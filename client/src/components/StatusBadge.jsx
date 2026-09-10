import React from 'react';
import { Clock, CheckCircle2, AlertCircle, FileSearch, ShieldCheck } from 'lucide-react';

export default function StatusBadge({ status }) {
  let badgeClass = 'badge-submitted';
  let Icon = Clock;
  let label = status || 'Submitted';

  switch (status) {
    case 'Submitted':
      badgeClass = 'badge-submitted';
      Icon = Clock;
      break;
    case 'Acknowledged':
      badgeClass = 'badge-acknowledged';
      Icon = AlertCircle;
      break;
    case 'Under Review':
    case 'Investigation':
      badgeClass = 'badge-review';
      Icon = FileSearch;
      break;
    case 'Action Taken':
      badgeClass = 'badge-action';
      Icon = ShieldCheck;
      break;
    case 'Resolved':
      badgeClass = 'badge-resolved';
      Icon = CheckCircle2;
      break;
    default:
      badgeClass = 'badge-submitted';
      Icon = Clock;
  }

  return (
    <span className={`badge ${badgeClass}`} title={`Status: ${label}`}>
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
