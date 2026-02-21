from datetime import datetime, timedelta, time, timezone


def generate_daily_logs(timeline, initial_cycle_used, waypoint_names=None):
    if not timeline:
        return []

    waypoint_names = waypoint_names or {}
    first_start = timeline[0]['start_time']
    last_end = timeline[-1]['end_time']

    current_date = first_start.date()
    last_date = last_end.date()

    total_days = (last_date - current_date).days + 1

    logs = []
    cumulative_on_duty = initial_cycle_used

    while current_date <= last_date:
        day_start = datetime.combine(current_date, time(0, 0), tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)

        segments = []
        day_miles = 0
        remarks = []

        for event in timeline:
            if event['end_time'] <= day_start or event['start_time'] >= day_end:
                continue

            seg_start = max(event['start_time'], day_start)
            seg_end = min(event['end_time'], day_end)
            seg_duration = (seg_end - seg_start).total_seconds() / 3600

            if seg_duration < 0.001:
                continue

            start_hour = (seg_start - day_start).total_seconds() / 3600
            end_hour = (seg_end - day_start).total_seconds() / 3600

            segments.append({
                'status': event['status'],
                'start_time': round(start_hour, 4),
                'end_time': round(end_hour, 4),
                'remark': event.get('remark', ''),
            })

            if event['status'] == 'driving' and event['miles'] > 0:
                event_duration = (event['end_time'] - event['start_time']).total_seconds() / 3600
                if event_duration > 0:
                    proportion = seg_duration / event_duration
                    day_miles += event['miles'] * proportion

            if event.get('remark'):
                remark_text = event['remark']
                loc_name = _get_location_name(event.get('location'))
                if loc_name:
                    remark_text = f"{remark_text} - {loc_name}"
                if remark_text not in remarks:
                    remarks.append(remark_text)

        segments = _merge_consecutive(segments)
        segments = _fill_gaps(segments)

        totals = _compute_totals(segments)

        day_on_duty = totals.get('driving', 0) + totals.get('on_duty_not_driving', 0)
        cumulative_on_duty += day_on_duty

        day_index = len(logs)
        from_loc, to_loc = _get_day_locations(
            timeline, day_start, day_end, waypoint_names, day_index, total_days
        )

        logs.append({
            'date': current_date.isoformat(),
            'day_number': len(logs) + 1,
            'from_location': from_loc,
            'to_location': to_loc,
            'total_miles': round(day_miles),
            'segments': segments,
            'totals': {k: round(v, 2) for k, v in totals.items()},
            'recap': {
                'cycle_hours_used': round(cumulative_on_duty, 2),
                'cycle_hours_available': round(max(70 - cumulative_on_duty, 0), 2),
            },
            'remarks': remarks,
        })

        current_date += timedelta(days=1)

    return logs


def _merge_consecutive(segments):
    if not segments:
        return segments

    merged = [segments[0].copy()]
    for seg in segments[1:]:
        prev = merged[-1]
        if (prev['status'] == seg['status']
                and abs(prev['end_time'] - seg['start_time']) < 0.01
                and not seg.get('remark')):
            prev['end_time'] = seg['end_time']
        else:
            merged.append(seg.copy())
    return merged


def _fill_gaps(segments):
    if not segments:
        return [{'status': 'off_duty', 'start_time': 0, 'end_time': 24, 'remark': ''}]

    filled = []

    segments.sort(key=lambda s: s['start_time'])

    if segments[0]['start_time'] > 0.01:
        filled.append({
            'status': 'off_duty',
            'start_time': 0,
            'end_time': segments[0]['start_time'],
            'remark': '',
        })

    for i, seg in enumerate(segments):
        if i > 0:
            prev_end = segments[i - 1]['end_time']
            if seg['start_time'] - prev_end > 0.01:
                filled.append({
                    'status': 'off_duty',
                    'start_time': prev_end,
                    'end_time': seg['start_time'],
                    'remark': '',
                })
        filled.append(seg)

    last_end = segments[-1]['end_time']
    if 24 - last_end > 0.01:
        filled.append({
            'status': 'off_duty',
            'start_time': last_end,
            'end_time': 24,
            'remark': '',
        })

    return filled


def _compute_totals(segments):
    totals = {
        'off_duty': 0,
        'sleeper_berth': 0,
        'driving': 0,
        'on_duty_not_driving': 0,
    }
    for seg in segments:
        duration = seg['end_time'] - seg['start_time']
        totals[seg['status']] = totals.get(seg['status'], 0) + duration
    return totals


def _get_location_name(location):
    if not location:
        return ''
    name = location.get('name', '')
    if ',' in name:
        parts = name.split(',')
        if len(parts) >= 3:
            return f"{parts[0].strip()}, {parts[2].strip()}"
        return parts[0].strip()
    return name


def _get_day_locations(timeline, day_start, day_end, waypoint_names, day_index, total_days):
    named_locs = []
    for event in timeline:
        if event['end_time'] <= day_start or event['start_time'] >= day_end:
            continue
        remark = event.get('remark', '')
        if 'Pickup' in remark:
            named_locs.append(waypoint_names.get('pickup', 'Pickup'))
        elif 'Dropoff' in remark:
            named_locs.append(waypoint_names.get('dropoff', 'Dropoff'))

    if day_index == 0:
        from_loc = waypoint_names.get('start', 'Start')
    elif named_locs:
        from_loc = named_locs[0]
    else:
        from_loc = 'En route'

    if day_index == total_days - 1:
        to_loc = waypoint_names.get('dropoff', 'Destination')
    elif named_locs:
        to_loc = named_locs[-1]
    else:
        to_loc = 'En route'

    return from_loc, to_loc
