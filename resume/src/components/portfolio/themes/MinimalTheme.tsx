import type { ResumeFormData } from "@/types/builder";
import { splitItems, splitParagraphs, dateRange, buildContacts } from "@/components/portfolio/shared";
import ContactLine from "@/components/portfolio/ContactLine";

export default function MinimalTheme({ data, hideContact }: { data: ResumeFormData; hideContact: boolean }) {
  const tech = splitItems(data.technicalSkills);
  const soft = splitItems(data.softSkills);
  const certs = splitItems(data.certifications);
  const langs = splitItems(data.languages);
  const projects = splitParagraphs(data.projects);
  const contacts = buildContacts(data, hideContact);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="border-b border-gray-200 pb-8">
          <h1 className="text-4xl font-bold tracking-tight">{data.fullName}</h1>
          <ContactLine
            items={contacts}
            className="mt-3 text-sm text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-1"
            linkClassName="hover:text-gray-900 underline-offset-2 hover:underline break-all"
            sepClassName="text-gray-300"
          />
        </header>

        {data.summary && (
          <Section title="About">
            <p className="text-gray-700 leading-relaxed whitespace-pre-line">{data.summary}</p>
          </Section>
        )}

        {data.workEntries?.length > 0 && (
          <Section title="Experience">
            <div className="space-y-6">
              {data.workEntries.map((w, i) => (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold text-gray-900">
                      {w.title}{w.company ? ` · ${w.company}` : ""}
                    </h3>
                    <span className="text-xs text-gray-500">{dateRange(w.startDate, w.endDate)}</span>
                  </div>
                  {w.projectName && <p className="text-sm text-gray-500 italic">{w.projectName}</p>}
                  {w.bullets?.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 space-y-1 text-sm text-gray-700">
                      {w.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {data.educationEntries?.length > 0 && (
          <Section title="Education">
            <div className="space-y-3">
              {data.educationEntries.map((e, i) => (
                <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{e.school}</h3>
                    <p className="text-sm text-gray-600">{e.degree}{e.gpa ? ` · GPA ${e.gpa}` : ""}</p>
                  </div>
                  <span className="text-xs text-gray-500">{e.graduationYear}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {(tech.length > 0 || soft.length > 0) && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {[...tech, ...soft].map((s, i) => (
                <span key={i} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">{s}</span>
              ))}
            </div>
          </Section>
        )}

        {projects.length > 0 && (
          <Section title="Projects">
            <div className="space-y-3 text-sm text-gray-700">
              {projects.map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
            </div>
          </Section>
        )}

        {(certs.length > 0 || langs.length > 0) && (
          <Section title="More">
            {certs.length > 0 && <p className="text-sm text-gray-700"><span className="font-medium">Certifications:</span> {certs.join(", ")}</p>}
            {langs.length > 0 && <p className="text-sm text-gray-700 mt-1"><span className="font-medium">Languages:</span> {langs.join(", ")}</p>}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-gray-400">{title}</h2>
      {children}
    </section>
  );
}
