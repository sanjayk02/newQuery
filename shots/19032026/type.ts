import { TableCellProps } from "@material-ui/core/TableCell";
import { Project } from '../../types';

/* ── New Shot Pivot Types ───────────────────────────────────────────────── */

export type PhaseData = {
    work_status:      string | null;
    approval_status:  string | null;
    submitted_at_utc: string | null;
    take:             string | null;
};

export type ShotPivot = {
    root:      string;
    project:   string;
    group_1:   string;
    group_2:   string;
    group_3:   string;
    relation:  string;
    component: string;
    phases:    { [key: string]: PhaseData };
};

export type ShotPivotResponse = {
    items:    ShotPivot[];
    total:    number;
    page:     number;
    perPage:  number;
    pageLast: number;
    hasNext:  boolean;
    hasPrev:  boolean;
    sort:     string;
    dir:      string;
};

/* ── Table Types ────────────────────────────────────────────────────────── */

export type ShotsDataTableProps = {
    project:        Project | null | undefined;
    shots:          ShotPivot[];
    tableFooter:    React.ReactElement;
    dateTimeFormat: Intl.DateTimeFormat;
    columnsState:   ColumnState;
};

export type Colors = Readonly<{
    lineColor:       string;
    backgroundColor: string;
}>;

export type Column = Readonly<{
    id:      string;
    label:   string;
    colors?: Colors;
    align?:  TableCellProps['align'];
    fixed?:  boolean;
}>;

export type ColumnState = {
    [key: string]: boolean;
};

export type PageProps = Readonly<{
    page:        number;
    rowsPerPage: number;
}>;

/* ── Legacy Types (kept for hooks compatibility) ────────────────────────── */

export type Shot = Readonly<{
    groups:   string[];
    relation: string;
}>;

export type ReviewInfo = {
    task_id:          string;
    project:          string;
    take_path:        string;
    root:             string;
    relation:         string;
    phase:            string;
    component:        string;
    take:             string;
    approval_status:  string;
    work_status:      string;
    submitted_at_utc: string;
    submitted_user:   string;
    modified_at_utc:  string;
    id:               number;
    groups:           string[];
    group_1:          string;
    review_comments:  ReviewComment[];
};

type ReviewComment = {
    text:             string;
    language:         string;
    attachments:      string[];
    is_translated:    boolean;
    need_translation: boolean;
};

export type LatestShotComponentDocument = Readonly<{
    component:        string;
    groups:           string[];
    phase:            string;
    submitted_at_utc: string;
}>;

type LatestComponent = Readonly<{
    component:       string;
    latest_document: LatestShotComponentDocument;
}>;

export type LatestComponents = {
    [key: string]: LatestComponent[];
};

export type LatestShotComponentDocumentsResponse = Readonly<{
    component:       string;
    latest_document: LatestShotComponentDocument;
}>;
