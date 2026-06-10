import type { ResumeFormData } from "@/types/builder";
import { splitItems, splitParagraphs, dateRange, buildContacts } from "@/components/portfolio/shared";
import ContactLine from "@/components/portfolio/ContactLine";

export default function ClassicTheme({ data, hideContact }: { data: ResumeFormData; hideContact: boolean }) {
  const tech = splitItems(data.technicalSkills);
  const soft = splitItems(data.softSkills);
  const certs = splitItems(data.certifications);
  const langs = splitItems(data.languages);
  const projects = splitParagraphs(data.projects);
  const contacts = buildContacts(data, hideContact);

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-serif">
      <div className="mx-auto max-w-3xl px-8 py-16">
        <header className="text-center border-b-2 border-stone-800 pb-6">
          <h1 className="text-4xl font-bold tracking-wide">{data.fullName}</h1>
          <ContactLine
            items={contacts}
            className="mt-3 text-sm text-stone-600 flex flex-wrap justify-center items-center gap-x-2 gap-y-1"
            linkClassName="hover:text-stone-900 underline-offset-2 hover:underline break-all"
            sepClassName="text-stone-400"
          />
        </header>

        {data.summary && (
          <Section title="Profile">
            <p className="text-stone-700 leading-relaxed whitespace-pre-line">{data.summary}</p>
          </Section>
        )}

        {data.workEntries?.length > 0 && (
          <Section title="Professional Experience">
            <div className="space-y-5">
              {data.workEntries.map((w, i) => {
                // Company headlines the entry; if it's missing, fall back to the title so the
                // heading is never blank. The subline then carries whatever isn't in the heading.
                const heading = w.company || w.title;
                const sub = [w.company ? w.title : null, w.projectName].filter(Boolean).join(" — ");
                return (
                <div key={i}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-bold text-stone-900">{heading}</h3>
                    <span className="text-sm text-stone-600 italic">{dateRange(w.startDate, w.endDate)}</span>
                  </div>
                  {sub && <p className="text-sm font-semibold text-stone-700">{sub}</p>}
                  {w.bullets?.length > 0 && (
                    <ul className="mt-2 list-disc pl-6 space-y-1 text-sm text-stone-700">
                      {w.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
                );
              })}
            </div>
          </Section>
        )}

        {data.educationEntries?.length > 0 && (
          <Section title="Education">
            <div className="space-y-3">
              {data.educationEntries.map((e, i) => (
                <div key={i} className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-stone-900">{e.school}</h3>
                    <p className="text-sm text-stone-700">{e.degree}{e.gpa ? ` · GPA ${e.gpa}` : ""}</p>
                  </div>
                  <span className="text-sm text-stone-600 italic">{e.graduationYear}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {(tech.length > 0 || soft.length > 0) && (
          <Section title="Skills">
            <p className="text-sm text-stone-700">{[...tech, ...soft].join(" • ")}</p>
          </Section>
        )}

        {projects.length > 0 && (
          <Section title="Projects">
            <div className="space-y-2 text-sm text-stone-700">
              {projects.map((p, i) => <p key={i} className="whitespace-pre-line break-words">{p}</p>)}
            </div>
          </Section>
        )}

        {(certs.length > 0 || langs.length > 0) && (
          <Section title="Additional Information">
            {certs.length > 0 && <p className="text-sm text-stone-700"><span className="font-bold">Certifications:</span> {certs.join(", ")}</p>}
            {langs.length > 0 && <p className="text-sm text-stone-700 mt-1"><span className="font-bold">Languages:</span> {langs.join(", ")}</p>}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-stone-800 border-b border-stone-300 pb-1">{title}</h2>
      {children}
    </section>
  );
}
