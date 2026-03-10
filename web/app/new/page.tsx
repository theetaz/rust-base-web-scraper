"use client";

import { NewJobForm } from "@/components/new-job-form";

export default function NewJobPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">New Scrape Job</h1>
      <NewJobForm />
    </div>
  );
}
