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
    { id: 'd_blocks_25', metric: 'blocksPlaced', target: 25, rewardCoins: 85, title: 'Place 25 Block Pieces Today' }
  ];

  const WEEKLY_TASK_TEMPLATES = [
    { id: 'w_clear_60', metric: 'linesCleared', target: 60, rewardCoins: 300, title: 'Weekly: Clear 60 Lines' },
    { id: 'w_levels_4', metric: 'levelsWon', target: 4, rewardCoins: 350, title: 'Weekly: Beat 4 Adventure Levels' },
    { id: 'w_score_8000', metric: 'scoreEarned', target: 8000, rewardCoins: 400, title: 'Weekly: Earn 8,000 Total Points' }
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
        changed = true;
      }
      if (st.weeklyKey !== weekKey) {
        st.weeklyKey = weekKey;
        st.weeklyProgress = {};
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

    getActiveTasks() {
      this.ensurePeriodsSynced();
      const st = STORAGE.state.tasks;
      const stats = STORAGE.state.stats;
      const todayKey = st.dailyDateKey;
      const weekKey = st.weeklyKey;

      const dailyList = DAILY_TASK_TEMPLATES.map(tpl => {
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

      const weeklyList = WEEKLY_TASK_TEMPLATES.map(tpl => {
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
