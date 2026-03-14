export interface Meeting {
  day: string;
  start_time: string;
  end_time: string;
  location: string;
}

export interface Availability {
  enrolled: number;
  capacity: number;
}

export interface Section {
  section_code: string;
  type: string;
  instructors: string[];
  availability: Availability;
  waitlist_count: number;
  enrolment_controls: string[];
  delivery_mode: string;
  cancelled: boolean;
  notes: string;
  meetings: Meeting[];
}

export interface Course {
  course_code: string;
  title: string;
  description: string;
  prerequisites: string;
  corequisites: string;
  exclusions: string;
  breadth_requirements: string;
  campus: string;
  session: string;
  notes: string;
  sections: Section[];
}
