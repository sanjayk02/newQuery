import { useEffect, useState, useReducer } from 'react';
import { LatestComponents, ReviewInfo, Shot, ShotPivot} from './types';
import {
  fetchLatestShotComponents,
  fetchShots,
  fetchShotReviewInfos,
  fetchShotThumbnail,
  fetchReviewShotsPivot,
  fetchShotCamDataTypes,
  TrackerShotAssignmentEntity,
  fetchTrackerShotAssignmentValues,
} from './api';
import {
  fetchPipelineSettingComponentsCommon,
  fetchPipelineSettingComponentsProject
} from '../api';
import { Project } from '../../types';

export function useFetchShots(
  project: Project | null | undefined,
  page: number,
  rowsPerPage: number,
  search?: string,
  approvalStatus?: string[],
  workStatus?: string[],
): { shots: Shot[], total: number } {
  const [shots, setShots] = useState<Shot[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    console.log(' useFetchShots useEffect triggered with:', {
      project,
      page,
      rowsPerPage,
      search,
      approvalStatus,
      workStatus
    });

    if (project == null) {
      return;
    }
    const controller = new AbortController();

    (async () => {
      const res = await fetchShots(
        project.key_name,
        page,
        rowsPerPage,
        search,
        approvalStatus,
        workStatus,
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (res != null) {
        setShots(res.shots);
        setTotal(res.total);
      }
    })();
    return () => controller.abort();
  }, [project, page, rowsPerPage, search, JSON.stringify(approvalStatus), JSON.stringify(workStatus)]);

  return { shots, total };
}

function reducer(
  state: { [key: string]: ReviewInfo },
  action: { shot: Shot, reviewInfos: ReviewInfo[] },
): { [key: string]: ReviewInfo } {
  const data: { [key: string]: ReviewInfo } = {};
  for (const reviewInfo of action.reviewInfos) {
    data[`${action.shot.groups[0]}-${action.shot.groups[1]}-${action.shot.groups[2]}-${reviewInfo.phase}`] = reviewInfo;
  }
  return { ...state, ...data };
};

export function useFetchShotReviewInfos(
  project: Project,
  shots: Shot[],
): { reviewInfos: { [key: string]: ReviewInfo } } {
  const [reviewInfos, dispatch] = useReducer(reducer, {});
  const controller = new AbortController();

  useEffect(() => {
    const loadShotReviewInfos = async (shot: Shot) => {
      try {
        const shotPath = shot.groups.join('/');
        const res = await fetchShotReviewInfos(
          project.key_name,
          shotPath,
          shot.relation,
          controller.signal,
        );
        const data = res.reviews;
        if (data.length > 0) {
          dispatch({ shot, reviewInfos: data });
        }
      } catch (err) {
        // FIX: Don't log AbortError as an error
        if (err instanceof Error && err.name === 'AbortError') {
          return; // Silently ignore
        }
        console.error('Failed to fetch shot review infos:', err);
      }
    };

    for (const shot of shots) {
      loadShotReviewInfos(shot);
    }

    return () => controller.abort();
  }, [project, shots]);

  return { reviewInfos };
};

function shotThumbnailReducer(
  state: { [key: string]: string },
  action: { shot: Shot, responseResult: string },
): { [key: string]: string } {
  const data: { [key: string]: string } = {};
  const shotPath = action.shot.groups.join('/');
  data[`${shotPath}-${action.shot.relation}`] = action.responseResult;
  return { ...state, ...data };
};

export function useFetchShotThumbnails(
  project: Project,
  shots: Shot[],
): { thumbnails: { [key: string]: string } } {
  const [thumbnails, dispatch] = useReducer(shotThumbnailReducer, {});

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const CONCURRENCY = 6;                           // cap simultaneous thumbnail loads

    const loadOne = async (shot: Shot) => {
      if (shot.groups.length !== 3 || shot.groups.some(g => !g)) {
        return;
      }
      try {
        const res = await fetchShotThumbnail(
          project.key_name, shot.groups, shot.relation, controller.signal,
        );
        if (!active || res == null || !res.ok) return;
        const blob = await res.blob();
        if (!active) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (active) dispatch({ shot, responseResult: reader.result as string });
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        if (!active) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        console.error('Failed to load thumbnail:', err);
      }
    };

    const run = async () => {
      for (let i = 0; i < shots.length; i += CONCURRENCY) {
        if (!active) return;
        await Promise.all(shots.slice(i, i + CONCURRENCY).map(loadOne));
      }
    };
    run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [project, JSON.stringify(shots)]);

  return { thumbnails };
};

export function useFetchPipelineSettingShotComponents(
  project: Project | null | undefined,
): { phaseComponents: { [key: string]: string[] } } {
  const [phaseComponents, setPhaseComponents] = useState<{ [key: string]: string[] }>({});

  useEffect(() => {
    if (project == null) {
      return;
    }
    const controller = new AbortController();
    (async () => {
      const _phaseComponents: { [key: string]: string[] } = {};
      const resCommon = await fetchPipelineSettingComponentsCommon(
        'shots',
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (resCommon != null) {
        for (const value of resCommon.values) {
          const keys = value.key.split('/');
          const phase = keys[keys.length - 1];
          _phaseComponents[phase] = value.value as string[];
        }
      }

      const resProject = await fetchPipelineSettingComponentsProject(
        project.key_name,
        'shots',
        controller.signal,
      ).catch((err) => {
        if (err.name === 'AbortError') {
          return;
        }
        console.error(err);
      });
      if (resProject != null) {
        for (const value of resProject.values) {
          const keys = value.key.split('/');
          const phase = keys[keys.length - 1];
          _phaseComponents[phase] = value.value as string[];
        }
      }
      setPhaseComponents(_phaseComponents);
    })();
    return () => controller.abort();
  }, [project]);

  return { phaseComponents };
};

export function useFetchLatestShotComponents(
  project: Project | null | undefined,
  shots: Shot[],
  components: { [key: string]: string[]; },
): { latestComponents: LatestComponents } {
  const [latestComponents, setLatestComponents] = useState<LatestComponents>({});

  useEffect(() => {
    if (project == null) {
      return;
    }

    let active = true;
    const controller = new AbortController();
    const _components = Object.values(components).flat();

    // Cap concurrent requests so a large shot set (e.g. group view) doesn't
    // exhaust the browser's connection pool (net::ERR_INSUFFICIENT_RESOURCES).
    const CONCURRENCY = 8;

    const loadLatestShotComponents = async () => {
      // Only fully-formed shots hit the network; skip when no components loaded.
      const targets =
        _components.length === 0
          ? []
          : shots.filter(
              shot =>
                shot.groups.length === 3 &&
                shot.groups.every(g => !!g && g.length > 0) &&
                !!shot.relation,
            );

      const _latestComponents: LatestComponents = {};

      for (let i = 0; i < targets.length; i += CONCURRENCY) {
        if (!active) return;
        const batch = targets.slice(i, i + CONCURRENCY);

        const results = await Promise.all(
          batch.map(shot =>
            fetchLatestShotComponents(
              project.key_name,
              shot.groups,
              shot.relation,
              _components,
              controller.signal,
            ).catch(err => {
              if (err instanceof Error && err.name === 'AbortError') return [];
              console.error('Failed to fetch latest asset components:', err);
              return [];
            }),
          ),
        );

        if (!active) return;
        results.forEach((res, idx) => {
          if (res.length > 0) {
            const shot = batch[idx];
            _latestComponents[`${shot.groups.join('-')}-${shot.relation}`] = res;
          }
        });
      }

      if (active) setLatestComponents(_latestComponents);
    };

    loadLatestShotComponents();

    return () => {
      active = false;
      controller.abort();
    };
  }, [project, JSON.stringify(shots), JSON.stringify(components)]);

  return { latestComponents };
};

export type UseShotsPivotParams = {
    project:        Project | null | undefined;
    page:           number;
    perPage:        number;
    orderKey?:      string;
    direction?:     string;
    phase?:         string;
    nameKey?:       string;
    approvalStatus?: string[];
    workStatus?:    string[];
    groups1?:       string[];
    shotsGroups?:   string[];
};

export function useFetchShotCamDataTypes(
    project: Project | null | undefined,
    shots: ShotPivot[],
): { camDataTypes: { [shotKey: string]: string } } {
    const [camDataTypes, setCamDataTypes] =
        useState<{ [shotKey: string]: string }>({});

    useEffect(() => {
        if (project == null || shots.length === 0) {
            setCamDataTypes({});
            return;
        }

        const controller = new AbortController();

        const shotKeys = shots
            .filter(s => s.group_1 && s.group_2 && s.group_3 && s.relation)
            .map(s => `${s.group_1}/${s.group_2}/${s.group_3}/${s.relation}`);

        (async () => {
            try {
                const res = await fetchShotCamDataTypes(
                    project.key_name,
                    shotKeys,
                    controller.signal,
                );

                setCamDataTypes(res.items || {});
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    return;
                }
                console.error('[CamDataType] Failed to fetch:', err);
            }
        })();

        return () => controller.abort();
    }, [project, JSON.stringify(shots)]);

    return { camDataTypes };
}

const normalizeAssignmentKey = (value: string | null | undefined): string => (
    (value || '').trim().toLowerCase()
);

const assignmentValue = (value: string | null | undefined): string | null => {
    const text = (value || '').trim();
    return text ? text : null;
};

const normalizeAssignmentField = (value: string): string => (
    value.trim().toLowerCase().replace(/[\s-]+/g, '_')
);

const ASSIGNMENT_FIELD_TO_PHASE: { [field: string]: string } = {
    layout_assigned_to: 'lay',
    lay_assign_to: 'lay',
    lay_assigned_to: 'lay',
    animation_assigned_to: 'anm',
    anm_assign_to: 'anm',
    anm_assigned_to: 'anm',
    genzu_assigned_to: 'gnz',
    gnz_assign_to: 'gnz',
    gnz_assigned_to: 'gnz',
    mat_assign_to: 'mat',
    mat_assigned_to: 'mat',
    fx_assign_to: 'fx',
    fx_assigned_to: 'fx',
    compositing_assigned_to: 'cmp',
    comp_assigned_to: 'cmp',
    cmp_assign_to: 'cmp',
    cmp_assigned_to: 'cmp',
    display_assigned_to: 'dsp',
    dsp_assign_to: 'dsp',
    dsp_assigned_to: 'dsp',
    cloth_assign_to: 'cloth',
    cloth_assigned_to: 'cloth',
    cfhair_assign_to: 'cfxhair',
    cfhair_assigned_to: 'cfxhair',
    cfxhair_assign_to: 'cfxhair',
    cfxhair_assigned_to: 'cfxhair',
    rtcgnz_assign_to: 'rtcgnz',
    rtcgnz_assigned_to: 'rtcgnz',
    rtcmat_assign_to: 'rtcmat',
    rtcmat_assigned_to: 'rtcmat',
    crd_assign_to: 'crd',
    crd_assigned_to: 'crd',
    drw_assign_to: 'drw',
    drw_assigned_to: 'drw',
    rtcdrw_assign_to: 'rtcdrw',
    rtcdrw_assigned_to: 'rtcdrw',
};

const getShotAssignmentCandidates = (shot: ShotPivot): string[] => {
    const parts = [shot.group_1, shot.group_2, shot.group_3]
        .map(part => (part || '').trim())
        .filter(Boolean);
    const relation = (shot.relation || '').trim();
    const candidates = new Set<string>();

    if (parts.length) {
        candidates.add(parts.join('/'));
        candidates.add(parts.join('-'));
    }
    if (parts.length && relation) {
        candidates.add(`${parts.join('/')}/${relation}`);
        candidates.add(`${parts.join('-')}-${relation}`);
    }
    [shot.group_3, shot.group_2, shot.group_1].forEach(part => {
        const text = (part || '').trim();
        if (text) candidates.add(text);
    });

    return Array.from(candidates).map(normalizeAssignmentKey);
};

const mergeTrackerShotAssignmentValues = (
    shots: ShotPivot[],
    assignmentEntities: TrackerShotAssignmentEntity[],
): ShotPivot[] => {
    const assignmentsByShot = new Map<string, NonNullable<TrackerShotAssignmentEntity['data']>>();
    assignmentEntities.forEach((entity) => {
        const shotKey = normalizeAssignmentKey(entity.group || '');
        if (shotKey && entity.data) {
            assignmentsByShot.set(shotKey, entity.data);
        }
    });

    return shots.map((shot) => {
        const assignment = getShotAssignmentCandidates(shot)
            .map(candidate => assignmentsByShot.get(candidate))
            .find(Boolean);

        if (!assignment) {
            return shot;
        }

        const phases = { ...(shot.phases || {}) };
        Object.entries(assignment).forEach(([field, value]) => {
            const normalizedField = normalizeAssignmentField(field);
            const phaseKey = ASSIGNMENT_FIELD_TO_PHASE[normalizedField] ||
                (normalizedField.endsWith('_assign_to')
                    ? normalizedField.replace(/_assign_to$/, '').toLowerCase()
                    : '');
            if (!phaseKey) {
                return;
            }
            const assignTo = assignmentValue(value);
            if (assignTo) {
                const phaseData = phases[phaseKey] || {
                    work_status: null,
                    approval_status: null,
                    submitted_at_utc: null,
                    take: null,
                };
                phases[phaseKey] = {
                    ...phaseData,
                    assign_to: assignTo,
                };
            }
        });

        return {
            ...shot,
            phases,
        };
    });
};

// new endpoints and types for latest shot components
export function useReviewShotsPivot({
    project,
    page,
    perPage,
    orderKey       = 'group1_only',
    direction      = 'ASC',
    approvalStatus = [],
    workStatus     = [],
}: UseShotsPivotParams): {
    shots:       ShotPivot[];
    total:       number;
    pageLast:    number;
    hasNext:     boolean;
    hasPrev:     boolean;
    loading:     boolean;
    groupCounts: { [key: string]: number };
    phases:      string[];
} {
    const [shots, setShots] = useState<ShotPivot[]>([]);
    const [total, setTotal] = useState(0);
    const [pageLast, setPageLast] = useState(0);
    const [hasNext, setHasNext] = useState(false);
    const [hasPrev, setHasPrev] = useState(false);
    const [loading, setLoading] = useState(false);
    const [phaseList, setPhaseList] = useState<string[]>([]);
    const [groupCounts, setGroupCounts] = useState<{ [key: string]: number }>({});

    useEffect(() => {
        if (project == null) return;

        let active = true;
        const controller = new AbortController();
        setLoading(true);

        const statuses = [...(approvalStatus || []), ...(workStatus || [])];

        (async () => {
            try {
                const res = await fetchReviewShotsPivot({
                    project:   project.key_name,
                    page,
                    perPage,
                    orderKey,
                    direction: direction.toUpperCase(),
                    statuses:  statuses,  // Send statuses
                    signal: controller.signal,
                });
                
                if (!active) return;
                
                // console.log('[ReviewShotsPivot] Response:', {
                //     itemsCount: res.items.length,
                //     total: res.total,
                //     phases: res.phases
                // });

                let shotsWithAssignments = res.items || [];
                try {
                    const assignmentValues = await fetchTrackerShotAssignmentValues(
                        project.key_name,
                        controller.signal,
                    );
                    if (!active) return;
                    shotsWithAssignments = mergeTrackerShotAssignmentValues(
                        shotsWithAssignments,
                        assignmentValues,
                    );
                } catch (err) {
                    if (err instanceof Error && err.name === 'AbortError') return;
                    console.warn('[PPI Tracker Shot Assign Values] failed:', err);
                }

                setShots(shotsWithAssignments);
                setTotal(res.total);
                setPageLast(res.pageLast);
                setHasNext(res.hasNext);
                setHasPrev(res.hasPrev);
                setPhaseList(res.phases || []);
                const responseGroupCounts = (res as any).groupCounts;
                if (responseGroupCounts && Object.keys(responseGroupCounts).length > 0) {
                    setGroupCounts(responseGroupCounts);
                } else {
                    let countItems = res.items || [];

                    if (res.total > countItems.length) {
                        const countRes = await fetchReviewShotsPivot({
                            project:   project.key_name,
                            page:      1,
                            perPage:   Math.max(res.total, perPage),
                            orderKey:  'group1_only',
                            direction: 'ASC',
                            statuses,
                            signal: controller.signal,
                        });

                        if (!active) return;
                        countItems = countRes.items || [];
                    }

                    const counts: { [key: string]: number } = {};
                    countItems.forEach((shot: ShotPivot) => {
                        const groupName = shot.group_1 || 'Ungrouped';
                        counts[groupName] = (counts[groupName] || 0) + 1;
                    });
                    setGroupCounts(counts);
                }
            } catch (err) {
                if (!active) return;
                if (err instanceof Error && err.name === 'AbortError') return;
                console.error('useReviewShotsPivot error:', err);
            } finally {
                if (active) setLoading(false);
            }
        })();

        return () => {
            active = false;
            controller.abort();
        };
    }, [
        project, page, perPage, orderKey, direction,
        JSON.stringify(approvalStatus), JSON.stringify(workStatus)
    ]);

    return { shots, total, pageLast, hasNext, hasPrev, loading, groupCounts, phases: phaseList };
}
