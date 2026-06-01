import type { ResumeFormData } from "@/types/builder";
import { splitItems, splitParagraphs, dateRange, buildContacts } from "@/components/portfolio/shared";
import ContactLine from "@/components/portfolio/ContactLine";

export default function ModernTheme({ data, hideContact }: { data: ResumeFormData; hideContact: boolean }) {
  const tech = splitItems(data.technicalSkills);
  const soft = splitItems(data.softSkills);
  const certs = splitItems(data.certifications);
  const langs = splitItems(data.languages);
  const projects = splitParagraphs(data.projects);
  const contacts = buildContacts(data, hideContact);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200">
      <header className="bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-600 px-6 py-20">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-5xl font-extrabold tracking-tight text-white">{data.fullName}</h1>
          {data.summary && <p className="mt-4 max-w-2xl text-lg text-white/90 whitespace-pre-line">{data.summary}</p>}
          <ContactLine
            items={contacts}
            className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/80"
            linkClassName="hover:text-white underline-offset-2 hover:underline break-all"
            sepClassName="text-white/40"
          />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-6 py-14 space-y-12">
        {data.workEntries?.length > 0 && (
          <Section title="Experience">
            <div className="space-y-6">
              {data.workEntries.map((w, i) => (
                <div key={i} className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-lg font-semibold text-white">
                      {w.title}{w.company ? <span className="text-indigo-400"> @ {w.company}</span> : null}
                    </h3>
                    <span className="text-xs text-gray-500">{dateRange(w.startDate, w.endDate)}</span>
                  </div>
                  {w.projectName && <p className="text-sm text-gray-400 italic">{w.projectName}</p>}
                  {w.bullets?.length > 0 && (
                    <ul className="mt-3 list-disc pl-5 space-y-1 text-sm text-gray-300">
                      {w.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}

        {(tech.length > 0 || soft.length > 0) && (
          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {tech.map((s, i) => (
                <span key={`t${i}`} className="rounded-lg bg-indigo-500/15 px-3 py-1 text-sm text-indigo-300 border border-indigo-500/30">{s}</span>
              ))}
              {soft.map((s, i) => (
                <span key={`s${i}`} className="rounded-lg bg-gray-800 px-3 py-1 text-sm text-gray-300 border border-gray-700">{s}</span>
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
                    <h3 className="font-semibold text-white">{e.school}</h3>
                    <p className="text-sm text-gray-400">{e.degree}{e.gpa ? ` · GPA ${e.gpa}` : ""}</p>
                  </div>
                  <span className="text-xs text-gray-500">{e.graduationYear}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {projects.length > 0 && (
          <Section title="Projects">
            <div className="space-y-3 text-sm text-gray-300">
              {projects.map((p, i) => (
                <p key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-4 whitespace-pre-line break-words">{p}</p>
              ))}
            </div>
          </Section>
        )}

        {(certs.length > 0 || langs.length > 0) && (
          <Section title="More">
            {certs.length > 0 && <p className="text-sm text-gray-300"><span className="font-medium text-white">Certifications:</span> {certs.join(", ")}</p>}
            {langs.length > 0 && <p className="text-sm text-gray-300 mt-1"><span className="font-medium text-white">Languages:</span> {langs.join(", ")}</p>}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-indigo-400">{title}</h2>
      {children}
    </section>
  );
}
