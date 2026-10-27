/**
 * Course and Intake Norms Configuration (Vishwas AICTE Approval System)
 *
 * NOTE: Every threshold defined here is a "placeholder pending APH. Not official."
 * AICTE Approval Process Handbook (APH) official figures must be verified before production deployment.
 */

export interface FacultyRatioNorm {
  studentsPerFaculty: number;
  note: string;
}

export interface BranchNorms {
  facultyStudentRatio: Record<string, FacultyRatioNorm>; // keyed by level or program
  minLandPerIntakeSqm: number;
  minLabsPerBranch: number;
  minBuiltUpAreaSqm: number;
  allowedIntakeSteps: number[];
  maxIntakeIncreaseStep: number;
  notice: string;
}

export const COURSE_NORMS: BranchNorms = {
  notice: 'placeholder pending APH. Not official.',
  // Faculty to student ratio: e.g. UG=1:20, PG=1:15, DIPLOMA=1:25
  facultyStudentRatio: {
    UG: {
      studentsPerFaculty: 20,
      note: 'placeholder pending APH. Not official.',
    },
    PG: {
      studentsPerFaculty: 15,
      note: 'placeholder pending APH. Not official.',
    },
    DIPLOMA: {
      studentsPerFaculty: 25,
      note: 'placeholder pending APH. Not official.',
    },
    MANAGEMENT: {
      studentsPerFaculty: 20,
      note: 'placeholder pending APH. Not official.',
    },
    MCA: {
      studentsPerFaculty: 20,
      note: 'placeholder pending APH. Not official.',
    },
    DEFAULT: {
      studentsPerFaculty: 20,
      note: 'placeholder pending APH. Not official.',
    },
  },
  // Minimum campus land per student intake in square meters across total institution proposals
  minLandPerIntakeSqm: 5, // placeholder pending APH. Not official.
  // Minimum labs required per technical branch
  minLabsPerBranch: 4, // placeholder pending APH. Not official.
  // Minimum departmental instructional/built-up area in square meters per branch
  minBuiltUpAreaSqm: 400, // placeholder pending APH. Not official.
  // Standard approved intake divisions/steps in AICTE norms
  allowedIntakeSteps: [30, 60, 120, 180, 240, 300], // placeholder pending APH. Not official.
  // Maximum single-year intake increase permitted per course
  maxIntakeIncreaseStep: 60, // placeholder pending APH. Not official.
};

/**
 * Returns the faculty:student ratio for a given branch level/program.
 * Value is a placeholder pending APH. Not official.
 */
export function getFacultyRatioNorm(level: string, program?: string): number {
  const normKey = (program && COURSE_NORMS.facultyStudentRatio[program.toUpperCase()])
    ? program.toUpperCase()
    : level.toUpperCase();

  const norm = COURSE_NORMS.facultyStudentRatio[normKey] || COURSE_NORMS.facultyStudentRatio.DEFAULT;
  return norm.studentsPerFaculty;
}
