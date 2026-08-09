export const notes = [
  {
    slug: 'seeing-information', title: 'Seeing information', status: 'published', kind: 'substantial',
    summary: 'Reading is partly the art of deciding what deserves to become visible.',
    body: `
      <p>Information is not visible merely because it is present. A page can contain every relevant fact and still keep its structure hidden. To see information is to notice distinctions: foreground and background, route and landmark, signal and atmosphere.</p>
      <p>That makes design less like decorating a container and more like arranging conditions for perception. [[contrast|Contrast]] separates; [[visual-hierarchy|visual hierarchy]] orders; [[attention|attention]] selects. None of them works alone. Strong contrast without order produces noise, while clear hierarchy without enough contrast remains theoretical.</p>
      <p>The same problem appears at different scales. A letterform must survive the eye’s limits. A [[maps|map]] must turn territory into choices. A [[links|link]] must be visible enough to suggest another direction without dismantling the sentence around it. Each is a proposal about what the reader should be able to notice next.</p>
      <blockquote>Good information design does not remove complexity. It gives complexity perceptible shape.</blockquote>
      <p>This collection follows that idea across [[color|color]], [[typography|typography]], [[wayfinding|wayfinding]], and [[spatial-interfaces|spatial interfaces]]. The links are not a taxonomy. They are trails between related ways of seeing.</p>`
  },
  {
    slug: 'color', title: 'Color', status: 'published', kind: 'substantial',
    summary: 'Color is relational: what a color does depends on what surrounds it.',
    body: `
      <p>Color names encourage us to think in isolated swatches: blue, vermilion, gray. Perception is less obedient. A color changes character beside another color, across a larger area, or under a different expectation. The practical unit of color is therefore a relationship.</p>
      <p>In interfaces, color can group, rank, warn, and create rhythm. But color is most reliable when it reinforces another cue. A red error state also needs language; a selected item benefits from shape or weight. This is not timidity. It recognizes that [[perception|perception]] varies with vision, display, lighting, and context.</p>
      <p>Designers often ask whether a palette is harmonious before asking whether its distinctions do useful work. [[contrast|Contrast]] is the bridge between aesthetics and function. It determines whether text can be read, whether layers separate, and whether the eye can find the next action.</p>
      <p>Color also carries learned meanings, but those meanings are neither universal nor fixed. The durable question is not “what does orange mean?” It is “what role is orange playing here, and what else tells the reader about that role?” See also [[accessibility|accessibility]] and [[data-visualization|data visualization]].</p>`
  },
  {
    slug: 'contrast', title: 'Contrast', status: 'published', kind: 'substantial',
    summary: 'Contrast creates a difference the reader can use.',
    body: `
      <p>Contrast is often reduced to light against dark, but any perceptible difference can organize information: large beside small, dense beside quiet, serif beside sans, moving beside still. The useful question is whether that difference carries meaning.</p>
      <p>A contrast can be visible yet ineffective. If everything is emphasized, emphasis becomes the texture of the page. If two levels differ only slightly, the reader spends effort decoding a distinction that the design was supposed to clarify. Effective contrast has both magnitude and purpose.</p>
      <p>This connects contrast to [[attention|attention]]. A sharp change recruits the eye, but the eye still needs somewhere worthwhile to land. It also connects to [[typography|typography]], where weight, size, spacing, and position form a coordinated system rather than independent styling choices.</p>
      <p>Minimum contrast requirements are an essential floor, not a complete theory of [[accessibility|accessibility]]. Readability also depends on type size, line length, glare, state changes, and whether meaning survives when color disappears. Contrast begins the conversation by making differences available to perception.</p>`
  },
  {
    slug: 'attention', title: 'Attention', status: 'published', kind: 'substantial',
    summary: 'Attention is a scarce routing mechanism, not a spotlight designers control.',
    body: `
      <p>Attention is sometimes described as a spotlight, which makes interface design sound like stage lighting: illuminate the important object and the audience will look. In practice, attention is negotiated. Goals, habits, motion, novelty, and fatigue all compete with visual signals.</p>
      <p>Design can influence that negotiation. [[contrast|Contrast]] makes candidates noticeable. [[visual-hierarchy|Visual hierarchy]] suggests an order. But coercive cues—constant badges, motion, urgency, interruption—borrow attention against the reader’s purposes. The debt appears as fatigue and mistrust.</p>
      <p>A quieter model treats attention as routing. The interface helps a person move limited perceptual resources toward the next useful distinction. This favors progressive disclosure, stable placement, and clear states over maximal salience.</p>
      <p>In [[data-visualization|data visualization]], the ethical stakes are obvious: emphasis can make one pattern seem inevitable while another disappears. In [[reading|reading]], needless competition raises [[cognitive-load|cognitive load]]. Attention is not only where a design points; it is what the design allows the reader to ignore.</p>`
  },
  {
    slug: 'visual-hierarchy', title: 'Visual hierarchy', status: 'published', kind: 'substantial',
    summary: 'Hierarchy turns simultaneous marks into a plausible reading order.',
    body: `
      <p>A page arrives all at once, but it is understood in sequence. Visual hierarchy proposes that sequence: begin here, group these, treat this as supporting evidence, return there when ready.</p>
      <p>Hierarchy is produced by several cues acting together—size, position, spacing, weight, [[color|color]], and repetition. When they agree, the structure feels obvious. When they conflict, reading becomes a small argument with the page. A huge tertiary label or a faint primary action asks the reader to resolve the contradiction.</p>
      <p>The best hierarchy is not necessarily dramatic. It needs enough [[contrast|contrast]] to expose relationships and enough restraint to preserve alternatives. This matters in linked writing, where a paragraph must remain readable even while its [[links|links]] offer departures.</p>
      <p>Hierarchy is also local. The right emphasis depends on the reader’s present task. A legend matters differently before and after a chart is understood; a navigation rail matters differently while orienting and while reading. [[attention|Attention]] and [[interface-navigation|interface navigation]] continually renegotiate what should lead.</p>`
  },
  {
    slug: 'typography', title: 'Typography', status: 'published', kind: 'substantial',
    summary: 'Typography gives language a visible pace, texture, and structure.',
    body: `
      <p>Typography is where language becomes spatial. Words acquire width; paragraphs acquire texture; arguments acquire pauses. A type system does more than select a pleasant face. It shapes how quickly structure can be recognized and how comfortably thought can continue.</p>
      <p>Good typography balances [[legibility|legibility]]—can these forms be distinguished?—with [[reading|reading]] as a sustained activity. Large type is not automatically readable, nor is short text automatically easy. Line length, spacing, measure, and hierarchy work as a system.</p>
      <p>Typography is also navigation. Headings make destinations, indentation declares containment, and recurring styles teach the reader what kind of object they are seeing. In this sense it borders [[maps|maps]]: both construct a traversable representation from marks on a surface.</p>
      <p>Variation should earn its keep. Weight can establish [[visual-hierarchy|hierarchy]], but too many weights dissolve it. Color can distinguish [[links|links]], but only if the surrounding prose stays coherent. The aim is not invisible typography; it is typography whose visible decisions support the text.</p>`
  },
  {
    slug: 'legibility', title: 'Legibility', status: 'published', kind: 'short',
    summary: 'Legibility concerns recognizing forms; reading asks what happens after recognition.',
    body: `
      <p>Legibility is the ease with which individual characters and words can be distinguished. It depends on letterforms, size, rendering, spacing, [[contrast|contrast]], and the conditions in which the text is seen.</p>
      <p>It is necessary but not sufficient. A perfectly distinguishable paragraph can still be exhausting because its measure is too long, its hierarchy unclear, or its language dense. That larger experience belongs to [[reading|reading]] and [[cognitive-load|cognitive load]].</p>`
  },
  {
    slug: 'reading', title: 'Reading', status: 'published', kind: 'substantial',
    summary: 'Reading alternates between immersion and orientation.',
    body: `
      <p>Reading is not a smooth intake of words. The eye jumps, pauses, predicts, verifies, and occasionally retreats. The mind builds a model while the page offers a sequence. Design participates by making that sequence easy to enter and easy to recover.</p>
      <p>Long-form interfaces often optimize immersion by removing everything around the text. That can help, but orientation has value too. A reader follows a [[links|link]], forgets a term, compares passages, or asks how this page fits the larger whole. The challenge is to preserve context without turning context into competition.</p>
      <p>Typography controls the local rhythm: line length, leading, paragraph shape. [[navigation|Navigation]] controls the larger rhythm: arrival, departure, return. When either is unstable, [[cognitive-load|cognitive load]] shifts from understanding the subject to operating the page.</p>
      <p>Linked notes make the alternation explicit. Each note should be coherent enough to read alone and porous enough to connect. The interface can then treat movement as part of reading rather than an interruption to it. This is where [[hypertext|hypertext]] becomes spatial.</p>`
  },
  {
    slug: 'cognitive-load', title: 'Cognitive load', status: 'published', kind: 'short',
    summary: 'An interface spends cognition whenever it asks the reader to hold hidden state.',
    body: `
      <p>Cognitive load is not a synonym for “too much on screen.” Removing visible context can increase effort if the reader must remember what disappeared. Complexity can be carried by the display or transferred into memory.</p>
      <p>Stable landmarks, consistent [[typography|typography]], and visible [[history|history]] externalize state. They leave more capacity for [[reading|reading]] and judgment. The goal is not minimal information; it is minimal unnecessary remembering.</p>`
  },
  {
    slug: 'maps', title: 'Maps', status: 'published', kind: 'substantial',
    summary: 'A map is a selective argument about what matters for movement.',
    body: `
      <p>A map is valuable because it leaves things out. It compresses a territory into distinctions suited to a purpose: roads for driving, contours for climbing, lines and stations for riding. Every map is therefore both a model and an argument.</p>
      <p>The map’s power comes from correspondence. Marks on one surface stand for relationships elsewhere. Readers learn a visual language—scale, symbols, adjacency—and use it to imagine choices they cannot yet see. [[wayfinding|Wayfinding]] begins when that representation meets a situated person with a destination.</p>
      <p>Interfaces borrow heavily from maps: overview and detail, landmarks, “you are here,” stable regions, and routes. But a menu is not automatically a map. It becomes map-like when it helps someone form a durable model of possible movement.</p>
      <p>This is why conventional graph diagrams are often poor primary reading surfaces. They show the territory of relationships while making the prose itself secondary. A linked reading interface can instead reveal one route while preserving [[spatial-memory|spatial memory]] of the path. See [[information-architecture|information architecture]].</p>`
  },
  {
    slug: 'wayfinding', title: 'Wayfinding', status: 'published', kind: 'substantial',
    summary: 'Wayfinding joins environmental cues with a person’s evolving mental route.',
    body: `
      <p>Wayfinding is more than following signs. It is the ongoing work of answering three questions: where am I, where can I go, and how will I recognize progress? Signs help, but so do sightlines, thresholds, landmarks, and the shape of the route itself.</p>
      <p>Digital navigation often overvalues destination selection and undervalues orientation. A click succeeds technically when the next page loads, yet the reader may not understand how the new place relates to the old one. [[interface-navigation|Interface navigation]] needs continuity as much as choice.</p>
      <p>Good wayfinding uses redundancy. A station has a name, a color, a position on a line, and a physical environment. Likewise, a note can have a title, URL, visual position, and visible ancestry. These cues cooperate to build [[spatial-memory|spatial memory]].</p>
      <p>[[maps|Maps]] offer overview; routes offer sequence; landmarks support recognition. No single representation answers every navigation question. The interesting design problem is deciding which one should remain present during [[reading|reading]].</p>`
  },
  {
    slug: 'spatial-memory', title: 'Spatial memory', status: 'published', kind: 'substantial',
    summary: 'Position can store context outside the reader’s head.',
    body: `
      <p>People often remember information partly by where it appeared: near the top of the page, behind the blue tab, two screens before the diagram. These memories are imprecise, but interfaces can either support or constantly invalidate them.</p>
      <p>Stable position acts as external memory. It lets recognition replace recall: the previous page is still there, so the reader need not reconstruct the route from a label alone. This reduces [[cognitive-load|cognitive load]] and makes [[wayfinding|wayfinding]] feel grounded.</p>
      <p>Spatial memory does not require photorealistic rooms or a graph canvas. Simple persistence can be enough. A stack of pages records order through overlap; compressed edges preserve old locations at lower detail. The representation changes with relevance without pretending the history never existed.</p>
      <p>This principle connects [[interface-navigation|interface navigation]] to [[history|history]]. Browser history is usually invisible machinery. Giving a current path spatial form makes that machinery perceptible while keeping the document—not the diagram—as the primary object.</p>`
  },
  {
    slug: 'interface-navigation', title: 'Interface navigation', status: 'published', kind: 'substantial',
    summary: 'Navigation is the design of continuity between states.',
    body: `
      <p>Navigation is commonly represented by controls: menus, tabs, links, back buttons. Those controls matter, but navigation is the larger experience of moving between states while maintaining a useful model of where one is.</p>
      <p>A transition can preserve continuity through language, position, or motion. The destination title repeats the link’s promise. A previous surface remains exposed. A modest animation shows which object arrived and which receded. These are not decorations; they are evidence about causality.</p>
      <p>When navigation hides its history, the reader pays with memory. When it displays every possibility equally, the reader pays with attention. A spatial path offers a middle ground: the active route stays visible while the larger [[information-architecture|information architecture]] remains latent.</p>
      <p>This approach belongs to [[hypertext|hypertext]], but it also borrows from [[wayfinding|wayfinding]] and [[spatial-memory|spatial memory]]. The route is not the territory. It is the particular sequence this reader has made through it.</p>`
  },
  {
    slug: 'hypertext', title: 'Hypertext', status: 'published', kind: 'substantial',
    summary: 'Hypertext lets an argument offer more than one next sentence.',
    body: `
      <p>Linear prose decides the next unit in advance. Hypertext introduces a controlled uncertainty: the current passage may point toward several plausible continuations. This makes [[links|links]] part of the writing, not merely a delivery mechanism.</p>
      <p>The freedom is easy to romanticize. Without context, branching becomes disorientation. The reader needs to know what changed, what remained, and whether returning will restore the prior state. [[history|History]] and [[interface-navigation|interface navigation]] are therefore part of hypertext’s rhetoric.</p>
      <p>A useful link names a relationship. It does more than say “click here”; it gives the destination a role in the present sentence. Dense linking works when each departure is meaningful and the current note remains coherent for readers who decline it.</p>
      <p>The [[the-web|web]] made hypertext ordinary, but browsers often render each traversal as replacement: one rectangle disappears, another takes its place. [[spatial-interfaces|Spatial interfaces]] can make the accumulated path visible without turning the network into a graph visualization.</p>`
  },
  {
    slug: 'links', title: 'Links', status: 'published', kind: 'substantial',
    summary: 'A link is both language and an executable relationship.',
    body: `
      <p>A link has a rare double life. It is part of a sentence, carrying grammatical and conceptual meaning, and it is also an action that changes the reader’s location. Good linked writing respects both roles.</p>
      <p>Link text should make the relationship legible before activation. “The limits of [[attention|attention]]” tells more than “read more.” Surrounding prose can indicate whether the destination defines, disputes, extends, or merely neighbors the present idea.</p>
      <p>Because links invite departure, their visual treatment requires balance. Too faint and the structure of [[hypertext|hypertext]] disappears; too loud and sustained [[reading|reading]] becomes a field of competing exits. Their appearance is a problem of [[contrast|contrast]] and rhythm.</p>
      <p>Links produce the [[the-web|web]] as an experienced structure. Each click chooses one edge from the graph. A spatial stack can remember those chosen edges as [[history|history]], leaving the reader’s actual path visible without demanding an overview of every possible path.</p>`
  },
  {
    slug: 'the-web', title: 'The web', status: 'published', kind: 'short',
    summary: 'The web is experienced locally even when its structure is planetary.',
    body: `
      <p>The web is described as a network, but a person usually experiences it as a sequence of documents. [[links|Links]] expose adjacent possibilities; the browser chooses one and records the movement in [[history|history]].</p>
      <p>This local experience is a strength. We do not need a map of the entire web before reading one page. [[hypertext|Hypertext]] works because global structure can remain underneath while a single path becomes temporarily meaningful.</p>`
  },
  {
    slug: 'history', title: 'History', status: 'published', kind: 'short',
    summary: 'Navigation history is a path the browser remembers but rarely shows.',
    body: `
      <p>Browser history preserves sequence, yet its usual interface is a pair of arrows and a separate list. The information exists without being perceptually present.</p>
      <p>A spatial history turns earlier documents into visible context. Recent ancestors can retain more detail; older ones can compress, much as memory keeps gist after detail fades. The same objects remain navigable at different levels of representation.</p>
      <p>This is not a replacement for Back and Forward. It is a visible expression of the same movement, connecting [[spatial-memory|spatial memory]], [[interface-navigation|interface navigation]], and [[spatial-interfaces|spatial interfaces]].</p>`
  },
  {
    slug: 'spatial-interfaces', title: 'Spatial interfaces', status: 'published', kind: 'substantial',
    summary: 'Spatial interfaces give relationships stable, manipulable positions.',
    body: `
      <p>An interface becomes spatial when position carries persistent meaning. A panel is not merely drawn on the left; being on the left explains its relationship to what arrived after it. Movement and overlap become part of the information model.</p>
      <p>The danger is theatrical space: elaborate rooms, zooming canvases, or physics that make ordinary tasks harder. Spatial design earns its cost when it externalizes a relationship the reader would otherwise need to remember.</p>
      <p>A stacked reading path is a modest spatial interface. Each linked note becomes another surface. Earlier surfaces compress toward the edge as the path deepens, preserving [[history|history]] while protecting the current [[reading|reading]] area. Recency determines level of detail.</p>
      <p>This combines [[spatial-memory|spatial memory]] with [[hypertext|hypertext]]. It also raises open questions about [[mobile-spatial-history|mobile spatial history]] and [[perceptual-adaptation|perceptual adaptation]]: how quickly do readers learn that a narrow edge is still the same page?</p>`
  },
  {
    slug: 'data-visualization', title: 'Data visualization', status: 'published', kind: 'short',
    summary: 'A visualization is an interface between data and visual judgment.',
    body: `
      <p>Data visualization turns values and relationships into marks that can be compared perceptually. Position and length usually support precise comparison; [[color|color]] can group or emphasize; annotation directs [[attention|attention]] toward an interpretation.</p>
      <p>The chart is not the data made neutral. Every encoding creates a [[visual-hierarchy|visual hierarchy]] and makes some questions easier than others. Responsible visualization makes those choices inspectable.</p>`
  },
  {
    slug: 'accessibility', title: 'Accessibility', status: 'published', kind: 'short',
    summary: 'Accessibility asks whether different people can perceive and operate the same meaning.',
    body: `
      <p>Accessibility is not a final compliance pass over an otherwise finished design. It changes the design’s model of perception and action from the beginning.</p>
      <p>Meaning should survive variation: color-vision differences, zoom, keyboard input, screen readers, reduced motion, narrow viewports, and temporary fatigue. That favors native [[links|links]], semantic headings, robust [[contrast|contrast]], and interfaces whose structure does not depend on animation.</p>`
  },
  {
    slug: 'perception', title: 'Perception', status: 'published', kind: 'short',
    summary: 'Perception is active inference constrained by sensation.',
    body: `
      <p>Perception is not a camera feed delivered to the mind. It is an active construction shaped by context, expectation, attention, and prior experience.</p>
      <p>That is why [[color|color]] changes beside other colors and why stable position can support [[spatial-memory|spatial memory]]. Interfaces do not simply present facts to neutral sensors; they participate in the conditions under which distinctions become available.</p>`
  },
  {
    slug: 'navigation', title: 'Navigation', status: 'published', kind: 'short',
    summary: 'Navigation coordinates choice, movement, and orientation.',
    body: `
      <p>Navigation is successful when a person can choose a direction, recognize arrival, and understand enough of the route to continue or return.</p>
      <p>Menus emphasize choice. [[history|History]] supports return. [[wayfinding|Wayfinding]] concerns orientation during movement. [[interface-navigation|Interface navigation]] has to combine all three without making the controls louder than the destination.</p>`
  },
  {
    slug: 'information-architecture', title: 'Information architecture', status: 'draft', kind: 'partial',
    summary: 'Information architecture shapes possible relationships before it chooses a visible route.',
    body: `
      <p>Information architecture is often expressed as a hierarchy because trees are easy to draw and administer. But concepts routinely belong in several contexts at once. A graph can represent those associations without forcing one canonical parent.</p>
      <p>The visible interface need not display that whole graph. A reader can encounter one active path through native [[links|links]], while the system keeps the larger set of relationships underneath. Compare [[maps|maps]] and [[interface-navigation|interface navigation]].</p>`
  },
  {
    slug: 'landmarks', title: 'Landmarks', status: 'draft', kind: 'partial',
    summary: 'Landmarks make location recognizable without requiring a full map.',
    body: `<p>A landmark is useful because it is distinct, stable, and encountered in relation to a route. In interfaces, titles, persistent panes, and characteristic page shapes can all become landmarks.</p><p>Landmarks support [[wayfinding|wayfinding]] through recognition and help seed [[spatial-memory|spatial memory]].</p>`
  },
  {
    slug: 'progressive-disclosure', title: 'Progressive disclosure', status: 'draft', kind: 'partial',
    summary: 'Show the detail that fits the reader’s present relationship to an object.',
    body: `<p>Progressive disclosure delays detail until it becomes relevant. A compressed history pane applies the same principle spatially: the object remains present, but its representation becomes simpler with distance.</p><p>This is a form of semantic zoom connected to [[attention|attention]] and [[spatial-interfaces|spatial interfaces]].</p>`
  },
  {
    slug: 'semantic-zoom', title: 'Semantic zoom', status: 'draft', kind: 'partial',
    summary: 'At different scales, preserve identity while changing representation.',
    body: `<p>Semantic zoom does not merely make an object smaller. It chooses a representation appropriate to the available space: prose becomes a title, a title becomes a labeled edge.</p><p>Continuity matters. The reader should perceive compression, not replacement. See [[progressive-disclosure|progressive disclosure]] and [[history|history]].</p>`
  },
  {
    slug: 'focus', title: 'Focus', status: 'draft', kind: 'partial',
    summary: 'Focus is both a perceptual state and a keyboard location.',
    body: `<p>Visual focus and keyboard focus are different systems that should tell a compatible story. When a new note opens, its heading should receive programmatic focus without throwing the reader into an arbitrary control.</p><p>Visible focus, sensible source order, and [[attention|attention]] belong to the same design conversation.</p>`
  },
  {
    slug: 'motion-continuity', title: 'Motion and continuity', status: 'draft', kind: 'partial',
    summary: 'Motion is useful when it explains what changed.',
    body: `<p>A short transition can show that a new surface emerged from a link and pushed older context aside. The motion carries causal information.</p><p>It should remain optional. Under reduced-motion preferences, position and semantics must still explain [[interface-navigation|navigation]].</p>`
  },
  {
    slug: 'mobile-spatial-history', title: 'Mobile spatial history', status: 'stub', kind: 'stub',
    summary: 'How can a narrow viewport preserve a path without sacrificing the current page?',
    body: `<p>On small screens, previous notes can persist as narrow labeled edges in a horizontally scrollable history region while the current note keeps most of the viewport. This note is still developing.</p>`
  },
  {
    slug: 'annotation', title: 'Annotation', status: 'stub', kind: 'stub',
    summary: 'Notes placed beside information can become part of its navigation.',
    body: `<p>A future note about marginalia, labels, and the relationship between commentary and [[reading|reading]].</p>`
  },
  {
    slug: 'overview-and-detail', title: 'Overview and detail', status: 'stub', kind: 'stub',
    summary: 'Multiple scales can answer different questions about the same information.',
    body: `<p>A future note connecting [[maps|maps]], [[data-visualization|data visualization]], and semantic zoom.</p>`
  },
  {
    slug: 'external-memory', title: 'External memory', status: 'stub', kind: 'stub',
    summary: 'Displays can hold state that people would otherwise have to remember.',
    body: `<p>This idea extends the argument in [[cognitive-load|cognitive load]] and [[spatial-memory|spatial memory]].</p>`
  },
  {
    slug: 'perceptual-adaptation', title: 'Perceptual adaptation', status: 'private', kind: 'unavailable',
    summary: 'Private / still developing.', unavailable: true
  },
  {
    slug: 'personal-knowledge-gardens', title: 'Personal knowledge gardens', status: 'private', kind: 'unavailable',
    summary: 'Private / still developing.', unavailable: true
  }
];

export const noteBySlug = new Map(notes.map((note) => [note.slug, note]));
