---
title: Our Team
type: landing

sections:
  - block: people
    content:
      title: Principal Investigator
      # Choose which groups/teams of users to display.
      #   Edit `user_groups` in each user's profile to add them to one or more of these groups.
      user_groups:
          - Principal Investigator
    design:
      view: 2
      show_interests: false
      show_role: true
      show_social: true
      columns: '1'

    - block: people
    content:
      title: Postdocs
      user_groups:
          - Postdocs
      sort_by: Params.last_name
      sort_ascending: true
    design:
      view: 2
      show_interests: false
      show_role: true
      show_social: false
      columns: '1'

     - block: people
    content:
      title: Graduate Students
      user_groups:
          - Graduate Students
      sort_by: Params.last_name
      sort_ascending: true
    design:
      view: 2
      show_interests: false
      show_role: true
      show_social: false
      columns: '1' 

     - block: people
    content:
      title: Undergraduate Students
      user_groups:
          - Undergraduate Students
      sort_by: Params.last_name
      sort_ascending: true
    design:
      view: 2
      show_interests: false
      show_role: true
      show_social: false
      columns: '1' 

     - block: people
    content:
      title: Alumni
      user_groups:
          - Alumni
      sort_by: Params.last_name
      sort_ascending: true
    design:
      view: 2
      show_interests: false
      show_role: true
      show_social: false
      columns: '1'

---
