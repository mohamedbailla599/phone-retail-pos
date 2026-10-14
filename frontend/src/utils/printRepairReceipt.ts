import type { RepairTicket } from '../api/repairs';
import { printThermalReceipt } from './printReceipt';

export function printRepairIntakeReceipt(ticket: RepairTicket) {
  const dateStr = new Date(ticket.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const estDateStr = ticket.estimated_completion_date
    ? new Date(ticket.estimated_completion_date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : 'À confirmer';

  const estCost = parseFloat(ticket.estimated_cost) || 0;
  const deposit = parseFloat(ticket.deposit_paid) || 0;
  const balance = Math.max(0, estCost - deposit);

  const html = `
    <div class="text-center border-b-dashed pb-2">
      <div class="font-bold text-base uppercase">BIGHRISSEN PHONE</div>
      <div class="text-xs">Service Maintenance & Réparation</div>
      <div class="text-xxs">Tél: +212 600-000000 • Casablanca, Maroc</div>
    </div>

    <div class="text-center my-2 border-box">
      <div class="text-xxs uppercase tracking-wider font-bold">TICKET DE DÉPÔT / RÉCEPTION</div>
      <div class="text-base font-bold">${ticket.ticket_number}</div>
      <div class="text-xxs">Date: ${dateStr}</div>
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="flex justify-between">
        <span class="font-bold">Client:</span>
        <span>${ticket.customer_name}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Tél:</span>
        <span>${ticket.customer_phone}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Réceptionné par:</span>
        <span>${ticket.created_by_username || 'Opérateur'}</span>
      </div>
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="font-bold uppercase text-xxs text-left mb-1">DÉTAILS DE L'APPAREIL</div>
      <div class="flex justify-between">
        <span>Appareil:</span>
        <span class="font-bold">${ticket.device_brand} ${ticket.device_model}</span>
      </div>
      ${ticket.device_color ? `
      <div class="flex justify-between">
        <span>Couleur:</span>
        <span>${ticket.device_color}</span>
      </div>` : ''}
      ${ticket.imei_or_serial ? `
      <div class="flex justify-between">
        <span>IMEI / S/N:</span>
        <span class="font-bold">${ticket.imei_or_serial}</span>
      </div>` : ''}
      ${ticket.passcode ? `
      <div class="flex justify-between">
        <span class="font-bold">Code / Schéma:</span>
        <span class="font-bold border-box py-0 px-1">${ticket.passcode}</span>
      </div>` : ''}
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="font-bold uppercase text-xxs text-left mb-1">PANNE DÉCLARÉE</div>
      <div class="flex justify-between">
        <span>Catégorie:</span>
        <span class="font-bold">${ticket.issue_type_display || ticket.issue_type}</span>
      </div>
      <div class="mt-1 text-left text-xxs bg-gray-100 p-1">
        ${ticket.issue_description || 'Non spécifié'}
      </div>
    </div>

    <div class="border-b-dashed py-1 text-xs">
      <div class="flex justify-between py-05">
        <span>Coût estimatif:</span>
        <span class="font-bold">${estCost.toFixed(2)} DH</span>
      </div>
      <div class="flex justify-between py-05">
        <span>Acompte versé:</span>
        <span class="font-bold">${deposit.toFixed(2)} DH</span>
      </div>
      <div class="flex justify-between py-05 border-b-dotted font-bold">
        <span>Reste à payer:</span>
        <span>${balance.toFixed(2)} DH</span>
      </div>
      <div class="flex justify-between py-05 text-xxs mt-1">
        <span>Date prévue:</span>
        <span class="font-bold">${estDateStr}</span>
      </div>
    </div>

    <div class="text-xxs text-center mt-2 px-1">
      <p class="font-bold mb-1">CONDITIONS GÉNÉRALES :</p>
      <p>1. La présentation de ce ticket original est obligatoire pour retirer l'appareil.</p>
      <p>2. L'atelier n'est pas responsable de la perte de données (sauvegarde requise préalable).</p>
      <p>3. Tout appareil non retiré après 60 jours sera considéré comme abandonné.</p>
    </div>

    <div class="mt-4 pt-3 border-t-dotted text-center text-xxs">
      <div class="flex justify-between text-left">
        <div>Signature Client :</div>
        <div class="text-right">Cachet Atelier :</div>
      </div>
      <div class="h-8"></div>
      <div class="border-b-dashed"></div>
      <div class="mt-1 font-bold">Conservez précieusement ce ticket</div>
    </div>
  `;

  printThermalReceipt(html, `Ticket_Depot_${ticket.ticket_number}`);
}

export function printRepairDeliveryReceipt(ticket: RepairTicket) {
  const deliveryDateStr = new Date(ticket.delivered_at || new Date()).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const finalCost = parseFloat(ticket.final_cost) || 0;
  const deposit = parseFloat(ticket.deposit_paid) || 0;
  const remainingPaid = Math.max(0, finalCost - deposit);

  const html = `
    <div class="text-center border-b-dashed pb-2">
      <div class="font-bold text-base uppercase">BIGHRISSEN PHONE</div>
      <div class="text-xs">Atelier Spécialisé Smartphones</div>
      <div class="text-xxs">Tél: +212 600-000000 • Casablanca, Maroc</div>
    </div>

    <div class="text-center my-2 border-box">
      <div class="text-xxs uppercase tracking-wider font-bold">FACTURE RÉPARATION & GARANTIE</div>
      <div class="text-base font-bold">${ticket.ticket_number}</div>
      <div class="text-xxs">Livré le: ${deliveryDateStr}</div>
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="flex justify-between">
        <span class="font-bold">Client:</span>
        <span>${ticket.customer_name}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Tél:</span>
        <span>${ticket.customer_phone}</span>
      </div>
      <div class="flex justify-between">
        <span class="font-bold">Appareil:</span>
        <span class="font-bold">${ticket.device_brand} ${ticket.device_model}</span>
      </div>
      ${ticket.imei_or_serial ? `
      <div class="flex justify-between">
        <span>IMEI / S/N:</span>
        <span class="font-bold">${ticket.imei_or_serial}</span>
      </div>` : ''}
    </div>

    <div class="border-b-dotted py-1 text-xs">
      <div class="font-bold uppercase text-xxs text-left mb-1">TRAVAIL EFFECTUÉ</div>
      <div class="flex justify-between">
        <span>Intervention:</span>
        <span class="font-bold">${ticket.issue_type_display || ticket.issue_type}</span>
      </div>
      ${ticket.technician_notes ? `
      <div class="mt-1 text-left text-xxs bg-gray-100 p-1">
        ${ticket.technician_notes}
      </div>` : ''}
    </div>

    <div class="border-b-dashed py-1 text-xs">
      <div class="flex justify-between py-05">
        <span>Montant Total Réparation:</span>
        <span class="font-bold">${finalCost.toFixed(2)} DH</span>
      </div>
      ${deposit > 0 ? `
      <div class="flex justify-between py-05 text-xxs">
        <span>Acompte initial déduit:</span>
        <span>-${deposit.toFixed(2)} DH</span>
      </div>` : ''}
      <div class="flex justify-between py-1 border-b-double text-sm font-bold">
        <span>Règlement final reçu:</span>
        <span>${remainingPaid.toFixed(2)} DH</span>
      </div>
      <div class="flex justify-between py-05 text-xxs mt-1">
        <span>Mode de règlement:</span>
        <span class="font-bold">${ticket.payment_method === 'BANK_TRANSFER' ? 'Virement Bancaire' : 'Espèces (Cash)'}</span>
      </div>
    </div>

    <div class="text-center my-2 border-box">
      <div class="text-xs font-bold uppercase text-gold">GARANTIE RÉPARATION : ${ticket.warranty_days} JOURS</div>
      <div class="text-xxs">Couvre les pièces remplacées et la main d'œuvre.</div>
      <div class="text-xxs text-gray-600">Exclut la casse, l'oxydation liquide et les chutes postérieures.</div>
    </div>

    <div class="text-center mt-3 text-xxs">
      <p class="font-bold">Merci de votre confiance !</p>
      <p>Bighrissen Phone - Votre partenaire High-Tech</p>
    </div>
  `;

  printThermalReceipt(html, `Facture_Reparation_${ticket.ticket_number}`);
}
