# Enriches the YAML in _data at build time, so lab members only ever edit plain entries.
#
# Papers gain: slug (anchor id), year, area, animation (falls back to "generic" when
# js/anim/<id>.js does not exist), authors_list (lab members linked to People), citation.
# Current students are ordered by degree (PhD, MS, undergrad), then last name.
# People gain: slug, thumb, papers_count, areas. Projects gain: slug, area, related papers.

module NetLab
  module_function

  def slugify(str)
    str.to_s.downcase.gsub(/[’'"]/, "").gsub(/[^a-z0-9]+/, "-").gsub(/^-|-$/, "")
  end

  def clean(str)
    str.to_s.gsub(/\s+/, " ").strip
  end

  def thumb_for(site, path)
    return nil if path.nil? || path.to_s.empty? || path.to_s.start_with?("http")
    base = File.basename(path.to_s, ".*")
    thumb = File.join("images", "thumbs", "#{base}.webp")
    File.exist?(File.join(site.source, thumb)) ? "/#{thumb}" : nil
  end

  def person_key(first, last)
    "#{first.to_s.strip[0].to_s.downcase} #{last.to_s.downcase.gsub(/[^a-z\-]/, '')}"
  end

  # Split "A. One, B. Two, and C. Three" into ["A. One", "B. Two", "C. Three"].
  def split_authors(str)
    clean(str).split(/\s*,\s*|\s+and\s+/).map { |a| a.sub(/^and\s+/, "").strip }.reject(&:empty?)
  end
end

Jekyll::Hooks.register :site, :post_read do |site|
  data = site.data
  areas = (data["areas"] || []).each_with_object({}) { |a, h| h[a["id"]] = a }

  # ---- People index ----
  people = {}
  register = lambda do |person, role, first, last|
    next if person.nil?
    full = NetLab.clean("#{first} #{last}")
    person["slug"] ||= NetLab.slugify(full)
    person["full_name"] ||= full
    person["role"] = role
    person["thumb"] ||= NetLab.thumb_for(site, person["image"])
    person["papers_count"] = 0
    person["areas"] = []
    people[NetLab.person_key(first, last)] = person
  end
  (data["faculty"] || []).each do |f|
    first, *rest = f["name"].to_s.split(" ")
    f["first_name"] ||= first
    f["last_name"] ||= rest.join(" ")
    register.call(f, "faculty", f["first_name"], f["last_name"])
  end
  (data["students"] || []).each { |s| register.call(s, "current", s["first_name"], s["last_name"]) }
  # Current students list PhD first, then master's, then undergraduates, by last name within each.
  degree_rank = { "PhD" => 0, "MS" => 1, "Undergrad" => 2 }
  data["students"]&.sort_by! { |s| [degree_rank.fetch(s["degree"].to_s, 3), s["last_name"].to_s.downcase, s["first_name"].to_s.downcase] }
  past = data["past_students"] || {}
  (past["graduate_students"] || []).each { |s| register.call(s, "alumni", s["first_name"], s["last_name"]) }
  (past["undergraduate_students"] || []).each { |s| register.call(s, "alumni-undergrad", s["first_name"], s["last_name"]) }

  find_person = lambda do |author|
    tokens = author.split(/\s+/)
    initial = tokens.first.to_s[0].to_s.downcase
    names = tokens.reject { |t| t.end_with?(".") }
    candidates = [names.join(" ")] + names
    candidates.each do |last|
      hit = people["#{initial} #{last.downcase.gsub(/[^a-z\-]/, '')}"]
      return hit if hit
    end
    nil
  end

  # ---- Projects ----
  projects = data["projects"] || []
  project_by_id = {}
  projects.each do |p|
    p["slug"] ||= p["id"] || NetLab.slugify(p["name"])
    p["area"] ||= "subprotocols"
    p["area_name"] = areas.dig(p["area"], "name")
    p["related"] = []
    p["thumbs"] = (p["images"] || []).map { |img| NetLab.thumb_for(site, img) || img }
    anim = p["animation"].to_s
    p["animation"] = "generic" unless !anim.empty? && File.exist?(File.join(site.source, "js", "anim", "#{anim}.js"))
    p["animation_status"] ||= "placeholder"
    project_by_id[p["slug"]] = p
  end

  # ---- Papers ----
  papers = data["papers"] || []
  papers.each_with_index do |paper, index|
    paper["title"] = NetLab.clean(paper["title"])
    paper["conference"] = NetLab.clean(paper["conference"])
    paper["abstract"] = NetLab.clean(paper["abstract"]) if paper["abstract"]
    paper["slug"] ||= paper["id"] || NetLab.slugify(paper["title"].split(/\s+/).first(6).join(" "))
    paper["year"] ||= paper["conference"].scan(/(?:19|20)\d\d/).last.to_i
    paper["order"] = index
    project = project_by_id[paper["project"].to_s]
    paper["area"] ||= project ? project["area"] : "subprotocols"
    paper["area_name"] = areas.dig(paper["area"], "name")
    anim = (paper["animation"] || paper["slug"]).to_s
    paper["animation"] = File.exist?(File.join(site.source, "js", "anim", "#{anim}.js")) ? anim : "generic"
    paper["animation_status"] ||= "placeholder"
    project["related"] << paper if project

    paper["authors_list"] = NetLab.split_authors(paper["authors"]).map do |name|
      person = find_person.call(name)
      if person
        person["papers_count"] += 1
        person["areas"] << paper["area"] unless person["areas"].include?(paper["area"])
        { "name" => name, "url" => "/people/##{person['slug']}", "slug" => person["slug"] }
      else
        { "name" => name }
      end
    end
    paper["authors"] = NetLab.clean(paper["authors"])
    paper["citation"] = "#{paper['authors']}. “#{paper['title']}.” #{paper['conference']}."
  end

  # ---- Articles ----
  (data["articles"] || []).each do |a|
    a["thumb"] ||= NetLab.thumb_for(site, a["image"])
  end
end
