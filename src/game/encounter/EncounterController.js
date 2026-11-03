/**
 * Tracks encounter lifecycle: player damage feedback hooks and full reset.
 */
export class EncounterController {
  constructor({ player, characters, combat, onHud, weaponView }) {
    this.player = player;
    this.characters = characters;
    this.combat = combat;
    this.onHud = onHud;
    this.weaponView = weaponView;
  }

  bind() {
    this.player.setDamageCallback((evt) => {
      this.onHud?.({ type: 'playerDamage', ...evt });
    });
    this.player.setDeathCallback(() => {
      this.onHud?.({ type: 'playerDeath' });
    });
    this.player.setRestartCallback(() => this.reset());
    this.player.setStatusCallback((evt) => {
      this.onHud?.(evt);
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('nodamage') === '1') {
      this.player.setNoDamage(true);
    }
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
    this.weaponView?.playEquip?.();
    this.onHud?.({
      type: 'restart',
      health: this.player.health,
      maxHealth: this.player.maxHealth,
    });
  }
}
