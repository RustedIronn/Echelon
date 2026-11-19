#!/bin/sh
# Rebuilds the valley composition from the bakes, step by step; each step saves the .blend and renders a check frame.
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; D="D:/Projects/Echelon/design-reference/environment/valley-composition-01"
"$B" --background --factory-startup --python "$D/build_land.py" 2>&1 | grep -E "BUILD|Traceback|Error" || exit 1
for s in build_skin build_grass build_forest build_range_river build_river_dress build_flowers build_hamlet build_air; do "$B" --background --python "$D/$s.py" 2>&1 | grep -E "done|placed|FLOWERS|Traceback|Error|line [0-9]"; done
