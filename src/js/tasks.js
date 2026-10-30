/**
 * Block Blast Ultimate — Unlimited Tasks, Daily/Weekly Challenges & Achievements Engine
 * Supports Daily tasks, Weekly challenges, and Infinite Progressive Milestones (1-to-unlimited tiers)
 * that work 100% offline using local device dates safely.
 */
(function (global) {
  'use strict';

  const STORAGE = global.BBU_STORAGE;
  const CFG = global.BBU_CONFIG;

  const DAILY_TASK_TEMPLATES = [
    { id: 'd_clear_10', metric: 'linesCleared', target: 10, rewardCoins: 80, title: 'Clear 10 Lines Today' },
    { id: 'd_score_1200', metric: 'scoreEarned', target: 1200, rewardCoins: 100, title: 'Score 1,200 Points Today' },
    { id: 'd_combo_2', metric: 'combosTriggered', target: 2, rewardCoins: 90, title: 'Trigger 2 Combo Streaks Today' },
    { id: 'd_powerup_1', metric: 'powerupsUsed', target: 1, rewardCoins: 75, title: 'Use 1 Power-Up Today' },
    { id: 'd_blocks_25', metric: 'blocksPlaced', target: 25, rewardCoins: 85, title: 'Place 25 Block Pieces Today' },
    { id: 'd_levels_1', metric: 'levelsWon', target: 1, rewardCoins: 150, title: 'Beat an Adventure Level Today' },
    { id: 'd_score_2500', metric: 'scoreEarned', target: 2500, rewardCoins: 130, title: 'Score 2,500 Points Today' },
    { id: 'd_combo_3', metric: 'combosTriggered', target: 3, rewardCoins: 120, title: 'Trigger 3 Combo Streaks Today' },
    { id: 'd_powerup_3', metric: 'powerupsUsed', target: 3, rewardCoins: 130, title: 'Use 3 Power-Ups Today' }
  ];

  const WEEKLY_TASK_TEMPLATES = [
    { id: 'w_clear_60', metric: 'linesCleared', target: 60, rewardCoins: 300, title: 'Weekly: Clear 60 Lines' },
    { id: 'w_levels_4', metric: 'levelsWon', target: 4, rewardCoins: 350, title: 'Weekly: Beat 4 Adventure Levels' },
    { id: 'w_score_8000', metric: 'scoreEarned', target: 8000, rewardCoins: 400, title: 'Weekly: Earn 8,000 Total Points' },
    { id: 'w_powerups_20', metric: 'powerupsUsed', target: 20, rewardCoins: 500, title: 'Weekly: Use 20 Power-Ups' },
    { id: 'w_blocks_300', metric: 'blocksPlaced', target: 300, rewardCoins: 450, title: 'Weekly: Place 300 Block Pieces' }
  ];

  const DAILY_REPEAT_TEMPLATES = [
    { id: 'd_bonus_lines', metric: 'linesCleared', target: 4, rewardCoins: 55, title: 'Bonus: Clear 4 More Lines' },
    { id: 'd_bonus_score', metric: 'scoreEarned', target: 700, rewardCoins: 60, title: 'Bonus: Score 700 More Points' },
    { id: 'd_bonus_blocks', metric: 'blocksPlaced', target: 12, rewardCoins: 50, title: 'Bonus: Place 12 More Pieces' },
    { id: 'd_bonus_combo', metric: 'combosTriggered', target: 1, rewardCoins: 65, title: 'Bonus: Trigger One Combo' },
    { id: 'd_bonus_power', metric: 'powerupsUsed', target: 1, rewardCoins: 55, title: 'Bonus: Use One Power-Up' }
  ];

  const WEEKLY_REPEAT_TEMPLATES = [
    { id: 'w_bonus_lines', metric: 'linesCleared', target: 15, rewardCoins: 120, title: 'Bonus: Clear 15 More Lines' },
    { id: 'w_bonus_score', metric: 'scoreEarned', target: 3000, rewardCoins: 140, title: 'Bonus: Score 3,000 More Points' },
    { id: 'w_bonus_blocks', metric: 'blocksPlaced', target: 80, rewardCoins: 120, title: 'Bonus: Place 80 More Pieces' },
    { id: 'w_bonus_power', metric: 'powerupsUsed', target: 8, rewardCoins: 150, title: 'Bonus: Use 8 Power-Ups' }
  ];

  // Infinite repeatable/escalating milestone templates (1-to-unlimited future tasks)
  const MILESTONE_TEMPLATES = [
    {
      baseId: 'm_career_lines',
      metric: 'totalLinesCleared',
      baseTarget: 20,
      stepTarget: 25,
      baseReward: 120,
      stepReward: 30,
      titleFn: (target, tier) => `Career Line Master Tier ${tier}: Clear ${target} Total Lines`
    },
    {
      baseId: 'm_career_levels',
      metric: 'levelsCompleted',
      baseTarget: 3,
      stepTarget: 3,
      baseReward: 150,
      stepReward: 40,
      titleFn: (target, tier) => `Adventure Conqueror Tier ${tier}: Beat ${target} Levels`
    },
    {
      baseId: 'm_career_blocks',
      metric: 'totalBlocksPlaced',
      baseTarget: 40,
      stepTarget: 50,
      baseReward: 100,
      stepReward: 25,
      titleFn: (target, tier) => `Block Architect Tier ${tier}: Place ${target} Blocks`
    },
    {
      baseId: 'm_career_games',
      metric: 'gamesPlayed',
      baseTarget: 5,
      stepTarget: 10,
      baseReward: 120,
      stepReward: 30,
      titleFn: (target, tier) => `Game Explorer Tier ${tier}: Start ${target} Games`
    },
    {
      baseId: 'm_career_powerups',
      metric: 'powerupsUsed',
      baseTarget: 10,
      stepTarget: 15,
      baseReward: 150,
      stepReward: 40,
      titleFn: (target, tier) => `Power Pro Tier ${tier}: Use ${target} Power-Ups`
    },
    {
      baseId: 'm_career_combo',
      metric: 'maxComboReached',
      baseTarget: 3,
      stepTarget: 2,
      baseReward: 180,
      stepReward: 50,
      titleFn: (target, tier) => `Combo Champion Tier ${tier}: Reach x${target}`
    }
  ];

  const TasksManager = {
    ensurePeriodsSynced() {
      const st = STORAGE.state.tasks;
      const todayKey = STORAGE.getLocalDateKey();
      const weekKey = STORAGE.getLocalWeekKey();
      let changed = false;

      if (st.dailyDateKey !== todayKey) {
        st.dailyDateKey = todayKey;
        st.dailyProgress = {};
        st.dailyGeneratedTasks = [];
        st.dailyReplacementCount = 0;
        changed = true;
      }
      if (st.weeklyKey !== weekKey) {
        st.weeklyKey = weekKey;
        st.weeklyProgress = {};
        st.weeklyGeneratedTasks = [];
        st.weeklyReplacementCount = 0;
        changed = true;
      }
      if (changed) STORAGE.save();
    },

    recordEvent(metric, amount = 1) {
      this.ensurePeriodsSynced();
      const delta = Number(amount) || 0;
      if (delta <= 0) return;

      const st = STORAGE.state.tasks;
      st.dailyProgress[metric] = (st.dailyProgress[metric] || 0) + delta;
      st.weeklyProgress[metric] = (st.weeklyProgress[metric] || 0) + delta;
      STORAGE.save();
    },

    createReplacementTask(category) {
      const st = STORAGE.state.tasks;
      const isDaily = category === 'daily';
      const templates = isDaily ? DAILY_REPEAT_TEMPLATES : WEEKLY_REPEAT_TEMPLATES;
      const tasksKey = isDaily ? 'dailyGeneratedTasks' : 'weeklyGeneratedTasks';
      const countKey = isDaily ? 'dailyReplacementCount' : 'weeklyReplacementCount';
      const metricProgress = isDaily ? st.dailyProgress : st.weeklyProgress;
      const periodKey = isDaily ? st.dailyDateKey : st.weeklyKey;
      const number = st[countKey] || 0;
      const template = templates[number % templates.length];

      st[countKey] = number + 1;
      st[tasksKey].push({
        uid: `${category}_${periodKey}_bonus_${number + 1}`,
        category,
        metric: template.metric,
        title: template.title,
        target: template.target,
        rewardCoins: template.rewardCoins,
        startProgress: Number(metricProgress[template.metric] || 0)
      });
    },

    getGeneratedTasks(category) {
      const st = STORAGE.state.tasks;
      const isDaily = category === 'daily';
      const generated = st[isDaily ? 'dailyGeneratedTasks' : 'weeklyGeneratedTasks'];
      const metricProgress = isDaily ? st.dailyProgress : st.weeklyProgress;
      return generated.map(task => {
        const progress = Math.min(task.target, Math.max(0, Number(metricProgress[task.metric] || 0) - task.startProgress));
        return Object.assign({}, task, {
          progress,
          completed: progress >= task.target,
          claimed: false
        });
      });
    },

    getActiveTasks() {
      this.ensurePeriodsSynced();
      const st = STORAGE.state.tasks;
      const stats = STORAGE.state.stats;
      const todayKey = st.dailyDateKey;
      const weekKey = st.weeklyKey;

      const dailyList = DAILY_TASK_TEMPLATES.filter(tpl => !st.claimedTaskIds[`daily_${todayKey}_${tpl.id}`]).map(tpl => {
        const claimKey = `daily_${todayKey}_${tpl.id}`;
        const progress = Math.min(tpl.target, st.dailyProgress[tpl.metric] || 0);
        const completed = progress >= tpl.target;
        const claimed = Boolean(st.claimedTaskIds[claimKey]);
        return {
          uid: claimKey,
          category: 'daily',
          title: tpl.title,
          progress,
          target: tpl.target,
          rewardCoins: tpl.rewardCoins,
          completed,
          claimed
        };
      });

      const weeklyList = WEEKLY_TASK_TEMPLATES.filter(tpl => !st.claimedTaskIds[`weekly_${weekKey}_${tpl.id}`]).map(tpl => {
        const claimKey = `weekly_${weekKey}_${tpl.id}`;
        const progress = Math.min(tpl.target, st.weeklyProgress[tpl.metric] || 0);
        const completed = progress >= tpl.target;
        const claimed = Boolean(st.claimedTaskIds[claimKey]);
        return {
          uid: claimKey,
          category: 'weekly',
          title: tpl.title,
          progress,
          target: tpl.target,
          rewardCoins: tpl.rewardCoins,
          completed,
          claimed
        };
      });

      // Unlimited progressive milestones: once tier N is claimed, tier N+1 automatically appears
      const milestoneList = MILESTONE_TEMPLATES.map(tpl => {
        const tier = Number(st.milestoneTierByTemplate[tpl.baseId] || 1);
        const target = tpl.baseTarget + (tier - 1) * tpl.stepTarget;
        const rewardCoins = tpl.baseReward + (tier - 1) * tpl.stepReward;
        const currentVal = Number(stats[tpl.metric] || 0);
        const progress = Math.min(target, currentVal);
        const claimKey = `milestone_${tpl.baseId}_t${tier}`;
        const completed = progress >= target;
        return {
          uid: claimKey,
          baseId: tpl.baseId,
          tier,
          category: 'milestone',
          title: tpl.titleFn(target, tier),
          progress,
          target,
          rewardCoins,
          completed,
          claimed: false
        };
      });

      dailyList.push(...this.getGeneratedTasks('daily'));
      weeklyList.push(...this.getGeneratedTasks('weekly'));
      return { dailyList, weeklyList, milestoneList };
    },

    claimTask(uid) {
      const { dailyList, weeklyList, milestoneList } = this.getActiveTasks();
      const all = [...dailyList, ...weeklyList, ...milestoneList];
      const found = all.find(t => t.uid === uid);

      if (!found) return { success: false, reason: 'Task not found' };
      if (!found.completed) return { success: false, reason: 'Task not yet completed' };
      if (found.claimed || STORAGE.state.tasks.claimedTaskIds[uid]) {
        return { success: false, reason: 'Reward already claimed' };
      }

      STORAGE.state.tasks.claimedTaskIds[uid] = true;
      if (found.category === 'milestone' && found.baseId) {
        STORAGE.state.tasks.milestoneTierByTemplate[found.baseId] = (found.tier || 1) + 1;
      } else if (found.category === 'daily' || found.category === 'weekly') {
        const generatedKey = found.category === 'daily' ? 'dailyGeneratedTasks' : 'weeklyGeneratedTasks';
        STORAGE.state.tasks[generatedKey] = STORAGE.state.tasks[generatedKey].filter(task => task.uid !== uid);
        this.createReplacementTask(found.category);
      }
      const newBalance = STORAGE.addCoins(found.rewardCoins);
      STORAGE.save();

      return {
        success: true,
        rewardCoins: found.rewardCoins,
        newBalance,
        task: found
      };
    },

    getAchievementsStatus() {
      const stats = STORAGE.state.stats;
      const claimedMap = STORAGE.state.achievements.claimed || {};
      return CFG.ACHIEVEMENTS.map(ach => {
        const current = Number(stats[ach.metric] || 0);
        const progress = Math.min(ach.target, current);
        const completed = progress >= ach.target;
        const claimed = Boolean(claimedMap[ach.id]);
        return {
          id: ach.id,
          title: ach.title,
          desc: ach.desc,
          progress,
          target: ach.target,
          rewardCoins: ach.rewardCoins,
          completed,
          claimed
        };
      });
    },

    claimAchievement(achId) {
      const list = this.getAchievementsStatus();
      const item = list.find(a => a.id === achId);
      if (!item) return { success: false, reason: 'Achievement not found' };
      if (!item.completed) return { success: false, reason: 'Achievement not unlocked yet' };
      if (item.claimed) return { success: false, reason: 'Achievement already claimed' };

      STORAGE.state.achievements.claimed[achId] = true;
      const newBalance = STORAGE.addCoins(item.rewardCoins);
      STORAGE.save();
      return { success: true, rewardCoins: item.rewardCoins, newBalance, achievement: item };
    }
  };

  global.BBU_TASKS = TasksManager;
})(typeof window !== 'undefined' ? window : globalThis);
