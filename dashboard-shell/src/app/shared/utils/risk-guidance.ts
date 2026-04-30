import { ProjectAnomaly } from '../services/risk.service';

export function getRecommendedActionsForAnomaly(anomaly: ProjectAnomaly | null): string[] {
  if (!anomaly) {
    return [];
  }

  const actions: string[] = [];

  if (anomaly.severity === 'CRITICAL' || anomaly.severity === 'HIGH') {
    actions.push('Escalate to the delivery and engineering leads within 24 hours and assign a single remediation owner.');
  } else {
    actions.push('Track in the weekly risk review and assign an owner to validate corrective actions.');
  }

  if (anomaly.trend === 'regression') {
    actions.push('Freeze non-essential scope changes until anomaly trend stabilizes for at least one reporting cycle.');
  } else if (anomaly.trend === 'watch') {
    actions.push('Increase monitoring cadence and verify signal quality before the next release checkpoint.');
  } else if (anomaly.trend === 'improving') {
    actions.push('Preserve current mitigation plan and confirm that improvements hold across the next sprint.');
  }

  if (anomaly.metrics.severityCounts.critical > 0) {
    actions.push('Run a root-cause review for critical events and capture preventive controls in the action tracker.');
  }

  return actions;
}
