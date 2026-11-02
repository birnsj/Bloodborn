/**
 * Tracks encounter lifecycle: player damage feedback hooks and full reset.
 */
export class EncounterController {
  constructor({ player, characters, combat, onHud }) {
    this.player = player;
    this.characters = characters;
    this.combat = combat;
    this.onHud = onHud;
  }

  bind() {
    this.player.setDamageCallback((evt) => {
      this.onHud?.({ type: 'playerDamage', ...evt });
    });
    this.player.setDeathCallback(() => {
      this.onHud?.({ type: 'playerDeath' });
    });
    this.player.setRestartCallback(() => this.reset());
  }

  handleEnemyAttack(evt) {
    if (!evt || this.player.dead) return;
    this.player.applyDamage(evt.damage);
    this.combat?.spawnImpact?.(evt.point, 0xff3333);
  }

  reset() {
    this.player.resetToSpawn();
    this.characters?.resetAll?.();
    if (this.combat) {
      this.combat.cooldown = 0;
    }
    this.onHud?.({
      type: 'restart',
      health: this.player.health,
      maxHealth: this.player.maxHealth,
    });
  }
}
