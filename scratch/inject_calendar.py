import sys

path = r'c:\Users\DELL\OneDrive\Bureau\RH_Intelligent\frontend_web\app\(protected)\admin\formations\page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add imports
import_str = '''import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FormationCalendar } from "@/components/formations/FormationCalendar"
'''

# Find a good place to insert imports, after SWR for example
swr_idx = content.find('import useSWR from "swr"')
if swr_idx != -1:
    end_of_line = content.find('\n', swr_idx) + 1
    content = content[:end_of_line] + import_str + content[end_of_line:]
else:
    print("Could not find import useSWR")
    sys.exit(1)

# Find grid start
grid_start = content.find('<div className="grid gap-6 lg:grid-cols-3">')
if grid_start == -1:
    print("Could not find grid start")
    sys.exit(1)

# Wrap start
wrap_start = '''<Tabs defaultValue="liste" className="w-full">
          <TabsList className="mb-4 bg-white/50 backdrop-blur-sm border border-gray-100 shadow-sm p-1">
            <TabsTrigger value="liste" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg px-6">Vue Tableau</TabsTrigger>
            <TabsTrigger value="calendrier" className="data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg px-6">Vue Calendrier</TabsTrigger>
          </TabsList>
          
          <TabsContent value="liste" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <div className="grid gap-6 lg:grid-cols-3">'''

content = content[:grid_start] + wrap_start + content[grid_start + len('<div className="grid gap-6 lg:grid-cols-3">'):]

# Find grid end
# It is followed by {/* Edit Dialog */}
edit_dialog_idx = content.find('{/* Edit Dialog */}')
if edit_dialog_idx == -1:
    print("Could not find Edit Dialog")
    sys.exit(1)

# The end of the grid is the second </div> before Edit Dialog
# Let's just find the exact string
old_end = '''          </Card>
        </div>
      </div>

      {/* Edit Dialog */}'''

new_end = '''          </Card>
        </div>
          </TabsContent>

          <TabsContent value="calendrier" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
            <FormationCalendar 
              formations={formations} 
              onEventClick={setViewFormation} 
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Dialog */}'''

if old_end in content:
    content = content.replace(old_end, new_end)
else:
    print("Could not find exact end string. Trying alternative.")
    # Try finding just '        </div>\n      </div>\n\n      {/* Edit Dialog */}'
    alt_old_end = '        </div>\n      </div>\n\n      {/* Edit Dialog */}'
    if alt_old_end in content:
        content = content.replace(alt_old_end, new_end)
    else:
        print("Still couldn't find end string.")
        # Let's just insert it right before {/* Edit Dialog */}
        # We need to replace `</div>\n      </div>\n` with `</div>\n          </TabsContent>...`
        # Using regex or just string manipulation
        sys.exit(1)


with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
