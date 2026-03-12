/**
 * About — Project overview, image creation process, and AI disclosure.
 */

import "./About.css";

interface AboutProps {
  onBack: () => void;
}

/* ── Section: The Project ────────────────────────────────────────────── */

function ProjectSection() {
  return (
    <section className="about-section">
      <h2>The Project</h2>
      <p>
        <em>The Ice Remembers</em> is a fictional world created by{" "}
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">tsonu</a>,
        built through procedural generation and simulation. It begins with{" "}
        <strong>Lore Weave</strong>, a framework that generates interconnected knowledge
        graphs &mdash; entities, cultures, relationships, events, and eras &mdash; through
        template-based generation and simulation-based relationship formation. The result
        is a world with its own history, politics, and internal logic, not authored
        scene-by-scene but grown through rules and emergence.
      </p>
      <p>
        The gallery you&rsquo;re viewing is one output of that process: images generated
        to depict the entities, scenes, and moments of this world. Every image here was
        created by AI image synthesis models, directed by a system called{" "}
        <strong>Illuminator</strong> that translates the world&rsquo;s narrative data into
        structured visual prompts.
      </p>
    </section>
  );
}

/* ── Section: Anti-Slopification Axes ────────────────────────────────── */

function AxesGrid() {
  return (
    <div className="about-axes">
      <div className="about-axis">
        <h4>Artistic Style</h4>
        <p>
          Over 30 styles across six categories &mdash; painting, ink and print, digital,
          camera, experimental, and document &mdash; define the visual medium and rendering
          approach. Each style carries a detailed prompt fragment that specifies technique,
          texture, and aesthetic sensibility. Oil painting gets visible brushstrokes and
          classical technique; ukiyo-e woodblock gets flat color planes and bold outlines;
          eldritch biomechanical gets organic-mechanical fusion with Giger-influenced forms.
          Each also carries negative prompts that actively suppress the wrong aesthetics.
        </p>
      </div>

      <div className="about-axis">
        <h4>Composition Style</h4>
        <p>
          Over 35 composition templates across nine categories control spatial arrangement,
          camera angle, and narrative framing. A &ldquo;Divine Monument&rdquo; composition
          places the subject in monumental bilateral symmetry with sacred geometry behind;
          a &ldquo;Confrontation&rdquo; frames two figures in dramatic opposition; a
          &ldquo;Field Study&rdquo; arranges its subject as a naturalist&rsquo;s botanical
          illustration. These ensure each image has deliberate spatial intent rather than
          the default centered-portrait-on-gradient that AI models gravitate toward.
        </p>
      </div>

      <div className="about-axis">
        <h4>Color Palette</h4>
        <p>
          31 distinct palettes define color harmony and emotional temperature using semantic
          language rather than rigid hex codes. &ldquo;Crimson Dynasty&rdquo; is dominated
          by deep crimsons and burgundy, grounded in charcoal shadows with antique gold
          accents. &ldquo;Void &amp; Iridescence&rdquo; uses absolute black with shifting
          spectral highlights. Each palette specifies dominant, supporting, and accent
          colors with distribution language &mdash; &ldquo;dominated by,&rdquo;
          &ldquo;supported by,&rdquo; &ldquo;accents sparingly placed&rdquo; &mdash; that
          guides the model without being prescriptive.
        </p>
      </div>

      <div className="about-axis">
        <h4>Visual Identity</h4>
        <p>
          For entity images, the system generates a <em>visual thesis</em> &mdash; the single
          dominant visual signal that defines what a character or place looks like &mdash; plus
          supporting traits that reinforce it. These are derived from the entity&rsquo;s
          narrative: their culture, species, role, era, and relationships. A scholarly sentinel
          of an ice realm gets frost-traced features and crystalline staff; a merchant prince
          gets flowing trade silks and weighted coin-purses. The visual identity anchors
          consistency across multiple images of the same subject.
        </p>
      </div>
    </div>
  );
}

/* ── Section: How Images Are Made ────────────────────────────────────── */

function ProcessSection() {
  return (
    <section className="about-section">
      <h2>How the Images Are Made</h2>
      <p>
        The images in this gallery are not the product of one-off prompts typed into an
        image generator. They are produced by a structured pipeline that combines
        narrative context from the world simulation with a layered visual direction system
        designed to prevent the generic, homogeneous aesthetic that plagues most
        AI-generated imagery.
      </p>

      <h3>The Anti-Slopification Pipeline</h3>
      <p>
        &ldquo;Slop&rdquo; &mdash; the bland, overlit, plasticky look of default AI images &mdash;
        happens when prompts lack specificity. The system addresses this through four
        independent axes of creative direction, each contributing distinct constraints
        that make generic results structurally impossible.
      </p>

      <AxesGrid />

      <h3>From Data to Image</h3>
      <p>
        When the system generates an image, it assembles a structured prompt from all four
        axes plus the entity&rsquo;s narrative context. A typical prompt includes sections
        for subject identity, narrative context, visual thesis, supporting traits, cultural
        visual markers, style direction, color palette, composition framing, and things to
        avoid. The result is a prompt that runs 200&ndash;400 words with precise creative
        direction &mdash; not a vague sentence but a detailed brief.
      </p>
      <p>
        For some models, an additional step reformats this structured prompt into the
        specific syntax that model interprets best. FLUX 2 models, for example, receive
        a JSON structure where style, palette, and composition are deterministic fields
        rather than natural language, while subject and scene descriptions are synthesized
        by a language model into the format FLUX handles most reliably.
      </p>
    </section>
  );
}

/* ── Section: Models ─────────────────────────────────────────────────── */

function ModelsSection() {
  return (
    <section className="about-section">
      <h2>Image Generation Models</h2>
      <p>
        This gallery contains images from eight AI image generation models across
        three providers. Different models have different strengths &mdash; some excel at
        painterly textures, others at photorealistic detail, others at compositional
        accuracy. Using multiple models is a deliberate choice: the visual variety
        mirrors the aesthetic breadth of the world itself.
      </p>

      <div className="about-models">
        <div className="about-model-group">
          <h4>Black Forest Labs &mdash; FLUX</h4>
          <ul>
            <li><strong>FLUX 2 Pro</strong> &mdash; Highest fidelity, strongest prompt adherence</li>
            <li><strong>FLUX 2 Max</strong> &mdash; Maximum resolution and detail</li>
            <li><strong>FLUX 1.1 Pro Ultra</strong> &mdash; Fast, high quality, good color control</li>
          </ul>
        </div>
        <div className="about-model-group">
          <h4>OpenAI</h4>
          <ul>
            <li><strong>GPT Image 1.5</strong> &mdash; Latest generation, strong compositional understanding</li>
            <li><strong>GPT Image 1</strong> &mdash; Reliable all-rounder</li>
            <li><strong>DALL-E 3</strong> &mdash; Good stylistic range</li>
          </ul>
        </div>
        <div className="about-model-group">
          <h4>Other</h4>
          <ul>
            <li><strong>Recraft V4</strong> &mdash; Strong illustration and design aesthetics</li>
            <li><strong>Seedream 4.5</strong> &mdash; Distinctive rendering characteristics</li>
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── Section: Curation ───────────────────────────────────────────────── */

function CurationSection() {
  return (
    <section className="about-section">
      <h2>Curation</h2>
      <p>
        Not every generated image makes it to the gallery. The system generates images
        in bulk across chronicles and entities, but a human curation step selects which
        images represent the world well. Style assignments, palette choices, and
        composition pairings are reviewed and adjusted. Images that don&rsquo;t meet the
        aesthetic standard &mdash; whether due to model artifacts, poor prompt
        interpretation, or simply not capturing the right feeling &mdash; are regenerated
        or discarded.
      </p>
      <p>
        The filters in this gallery (style, composition, palette, model, entity kind,
        culture) reflect the actual metadata of the generation pipeline. They&rsquo;re
        not tags applied after the fact &mdash; they&rsquo;re the creative parameters
        that shaped each image.
      </p>
    </section>
  );
}

/* ── Section: AI Disclosure ──────────────────────────────────────────── */

function DisclosureSection() {
  return (
    <section className="about-section about-section--disclosure">
      <h2>AI Image Disclosure</h2>
      <p>
        All images displayed in this gallery were generated using AI image synthesis
        models. They were created from structured text prompts authored and curated by
        tsonu using the Illuminator system described above. These images are
        AI-generated and do not depict real people, places, or events.
      </p>
      <p>
        The prompts that produced these images incorporate human-authored creative
        direction (artistic styles, color palettes, composition templates, and narrative
        context from the world simulation), but the final pixel-level rendering was
        performed entirely by AI image generation models.
      </p>

      <h3>Copyright &amp; Usage</h3>
      <p>
        Under current U.S. copyright law, purely AI-generated images are not eligible for
        copyright protection (<em>Thaler v. Perlmutter</em>, affirmed 2026). The images in
        this gallery are not claimed as copyrighted works. The human-authored elements of
        this site &mdash; the code, text, design, prompt templates, style definitions,
        and world-building content &mdash; are original works.
      </p>
      <p>
        The image generation models used in this gallery are operated under their
        respective providers&rsquo; terms of service: Black Forest Labs (FLUX),
        OpenAI (GPT Image / DALL-E), and others as applicable.
      </p>

      <h3>EU AI Act Compliance</h3>
      <p>
        In accordance with the EU AI Act (effective August 2026), all images on this site
        are clearly identified as AI-generated content. The models, methods, and human
        involvement in the creation process are described in this disclosure.
      </p>
    </section>
  );
}

/* ── About Page ──────────────────────────────────────────────────────── */

export default function About({ onBack }: Readonly<AboutProps>) {
  return (
    <div className="about">
      <nav className="about-nav">
        <button className="about-back" onClick={onBack}>&larr; Back to Gallery</button>
      </nav>

      <article className="about-content">
        <header className="about-hero">
          <h1 className="about-title">The Ice Remembers</h1>
          <p className="about-subtitle">A procedurally generated world, visually realized</p>
        </header>

        <ProjectSection />
        <ProcessSection />
        <ModelsSection />
        <CurationSection />
        <DisclosureSection />
      </article>

      <footer className="app-footer">
        <span>Copyright &copy; 2026</span>
        <a href="https://ahara.io" target="_blank" rel="noopener noreferrer">
          <img src="/tsonu-combined.png" alt="tsonu" height="14" />
        </a>
      </footer>
    </div>
  );
}
