import { Duplicate } from "./Duplicate";

export interface Scan {
    id: string;
    user: string;
    scanDate: string;
    status: string;
    duplicates: Duplicate[];
}