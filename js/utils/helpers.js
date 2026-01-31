export function domIdFromPath(path) {
  return path.replaceAll('.', '__');
}

export function getPercentileZone(percentile) {
  if (percentile < 26) return { name: "Needs Work", class: "needs-work", color: "var(--zone-needs-work)" };
  if (percentile < 51) return { name: "Below Average", class: "below-avg", color: "var(--zone-below-avg)" };
  if (percentile < 76) return { name: "Above Average", class: "above-avg", color: "var(--zone-above-avg)" };
  if (percentile < 91) return { name: "Strong", class: "strong", color: "var(--zone-strong)" };
  return { name: "Elite", class: "elite", color: "var(--zone-elite)" };
}

export function createPercentileBand(percentile) {
  const zone = getPercentileZone(percentile);
  return `
    <div class="percentile-band-container">
      <div class="percentile-band">
        <div class="percentile-marker" style="left: ${percentile}%;"></div>
      </div>
      <div class="percentile-zone-label">${zone.name}</div>
    </div>
  `;
}

export function createGoalProgress(current, target, categoryPath) {
  if (!target || target === 0) return '';
  
  const gap = target - current;
  const progress = Math.min((current / target) * 100, 100);
  
  let statusClass = 'on-track';
  if (current < target * 0.7) statusClass = 'far-behind';
  else if (current < target * 0.85) statusClass = 'behind';
  
  return `
    <div class="goal-progress-container">
      <div class="goal-progress-header">
        <span class="goal-progress-label">🎯 Goal Progress</span>
        <span class="goal-progress-values">${Math.round(current)} / ${Math.round(target)}</span>
      </div>
      <div class="goal-progress-bar">
        <div class="goal-progress-fill ${statusClass}" style="width: ${progress}%"></div>
      </div>
      <div class="goal-progress-gap">${gap > 0 ? `${Math.round(gap)} points to goal` : 'Goal achieved! 🎉'}</div>
    </div>
  `;
}

export function formatDateLabel(date, aggregation) {
  const d = new Date(date);
  switch (aggregation) {
    case 'daily':
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    case 'weekly':
      return `Week of ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    case 'monthly':
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    case 'yearly':
      return d.getFullYear().toString();
    default:
      return d.toLocaleDateString();
  }
}

export function getAggregationLevel(scale) {
  switch (scale) {
    case 'daily':
      return 'daily';
    case 'weekly':
      return 'weekly';
    case 'monthly':
      return 'monthly';
    case 'yearly':
      return 'yearly';
    default:
      return 'daily';
  }
}

export function aggregateData(data, aggregation) {
  const grouped = {};
  
  data.forEach(entry => {
    const date = new Date(entry.created_at);
    let key;
    
    switch (aggregation) {
      case 'daily':
        key = date.toISOString().split('T')[0];
        break;
      case 'weekly':
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
        break;
      case 'monthly':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'yearly':
        key = date.getFullYear().toString();
        break;
      default:
        key = date.toISOString().split('T')[0];
    }
    
    const groupKey = `${key}_${entry.metric_name}`;
    
    if (!grouped[groupKey]) {
      grouped[groupKey] = {
        date: key,
        metric_name: entry.metric_name,
        values: [],
        percentiles: []
      };
    }
    
    grouped[groupKey].values.push(entry.value);
    if (entry.percentile !== null) {
      grouped[groupKey].percentiles.push(entry.percentile);
    }
  });
  
  return Object.values(grouped).map(group => ({
    date: group.date,
    metric_name: group.metric_name,
    value: group.values.reduce((a, b) => a + b, 0) / group.values.length,
    percentile: group.percentiles.length > 0 
      ? group.percentiles.reduce((a, b) => a + b, 0) / group.percentiles.length 
      : null
  }));
}
