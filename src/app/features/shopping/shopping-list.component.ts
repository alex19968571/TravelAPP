import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ShoppingItem } from '../../core/models';
import { ShoppingService } from '../../core/services/shopping.service';
import { SyncEngineService } from '../../core/services/sync-engine.service';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  template: `
    <div class="page-container">
      <header class="page-header">
        <a [routerLink]="['/trips', tripId]" class="back-btn">← 返回行程</a>
        <h1>🛍️ 購物清單</h1>
        <div class="summary">
          合計 <strong>{{ totalAmount() | number:'1.0-0' }}</strong> 元
          ({{ boughtCount() }}/{{ items().length }})
        </div>
      </header>

      <!-- 新增表單 -->
      <form [formGroup]="form" (ngSubmit)="addItem()" class="card add-form">
        <div class="form-grid">
          <div class="form-row span-2">
            <label>品項名稱 *</label>
            <input formControlName="title" placeholder="例：藥妝店面膜" />
          </div>
          <div class="form-row">
            <label>數量</label>
            <input formControlName="quantity" type="number" min="1" />
          </div>
          <div class="form-row">
            <label>單價</label>
            <input formControlName="unit_price" type="number" min="0" step="any" />
          </div>
          <div class="form-row span-2">
            <label>備註</label>
            <input formControlName="description" placeholder="選填" />
          </div>
          <div class="form-row span-2">
            <label>商品連結</label>
            <input formControlName="item_url" placeholder="https://..." />
          </div>
        </div>
        <div class="form-total">小計：<strong>{{ formTotal() | number:'1.0-0' }}</strong> 元</div>
        <button type="submit" class="btn-primary" [disabled]="form.invalid">加入清單</button>
      </form>

      <!-- 清單 -->
      <div class="items-list">
        @for (item of items(); track item.client_record_id) {
          <div class="item-card card" [class.bought]="item.is_bought">
            <div class="item-main">
              <input type="checkbox" [checked]="item.is_bought"
                (change)="toggleBought(item)" class="checkbox" />
              <div class="item-info">
                <div class="item-title">{{ item.title }}</div>
                @if (item.description) {
                  <div class="item-desc">{{ item.description }}</div>
                }
                @if (item.item_url) {
                  <a [href]="item.item_url" target="_blank" class="item-link">🔗 商品連結</a>
                }
              </div>
              <div class="item-price">
                <div class="qty">× {{ item.quantity }}</div>
                <div class="amount">{{ item.total_amount | number:'1.0-0' }} 元</div>
              </div>
            </div>

            <div class="item-actions">
              <label class="image-upload-btn">
                📷 上傳圖片
                <input type="file" accept="image/*" hidden
                  (change)="uploadImage($event, item.client_record_id)" />
              </label>
              @if (item.image_url) {
                <img [src]="item.image_url" class="item-image" alt="商品圖" />
              }
              <button class="remove-btn" (click)="deleteItem(item.client_record_id)">🗑 刪除</button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page-container { max-width: 900px; margin: 0 auto; padding: 1.5rem; }
    .page-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
    .back-btn { color: #667eea; text-decoration: none; font-weight: 500; }
    h1 { font-size: 1.6rem; font-weight: 700; color: #1a1a2e; margin: 0; flex: 1; }
    .summary { color: #667eea; font-size: 0.95rem; }
    .card { background: white; border-radius: 16px; padding: 1.5rem;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .add-form { }
    .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem; }
    .span-2 { grid-column: 1 / -1; }
    .form-row label { display: block; font-weight: 500; margin-bottom: 0.35rem; color: #555; font-size: 0.9rem; }
    .form-row input { width: 100%; padding: 0.625rem 0.875rem; border: 1.5px solid #ddd;
      border-radius: 10px; font-size: 0.95rem; box-sizing: border-box; }
    .form-total { margin-bottom: 1rem; color: #555; font-size: 0.95rem; }
    .form-total strong { color: #667eea; font-size: 1.1rem; }
    .btn-primary { background: #667eea; color: white; border: none; border-radius: 10px;
      padding: 0.625rem 1.5rem; font-weight: 600; cursor: pointer; }
    .btn-primary:disabled { opacity: 0.5; }
    .items-list { display: flex; flex-direction: column; gap: 0.75rem; }
    .item-card.card { padding: 1rem 1.25rem; transition: opacity 0.2s; }
    .item-card.bought { opacity: 0.5; }
    .item-main { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 0.75rem; }
    .checkbox { width: 20px; height: 20px; accent-color: #667eea; flex-shrink: 0; margin-top: 3px; cursor: pointer; }
    .item-info { flex: 1; }
    .item-title { font-weight: 600; font-size: 1rem; color: #1a1a2e; }
    .item-desc { font-size: 0.875rem; color: #666; margin-top: 0.25rem; }
    .item-link { font-size: 0.8rem; color: #667eea; text-decoration: none; margin-top: 0.25rem; display: block; }
    .item-price { text-align: right; }
    .qty { font-size: 0.875rem; color: #999; }
    .amount { font-weight: 700; color: #1a1a2e; font-size: 1.05rem; }
    .item-actions { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
    .image-upload-btn { cursor: pointer; color: #667eea; font-size: 0.875rem;
      padding: 0.375rem 0.875rem; border: 1.5px solid #667eea; border-radius: 8px; }
    .item-image { width: 60px; height: 60px; object-fit: cover; border-radius: 8px; }
    .remove-btn { background: none; border: none; color: #e53e3e; cursor: pointer;
      font-size: 0.875rem; margin-left: auto; }
  `]
})
export class ShoppingListComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private shoppingService = inject(ShoppingService);
  private syncEngine = inject(SyncEngineService);
  private fb = inject(FormBuilder);

  tripId!: string;
  items = signal<ShoppingItem[]>([]);

  // Angular Signals 即時計算
  readonly quantity = computed(() => Number(this.form.get('quantity')?.value ?? 1));
  readonly unitPrice = computed(() => Number(this.form.get('unit_price')?.value ?? 0));
  readonly formTotal = computed(() => this.quantity() * this.unitPrice());

  totalAmount = computed(() => this.items().reduce((sum, i) => sum + i.total_amount, 0));
  boughtCount = computed(() => this.items().filter(i => i.is_bought).length);

  form = this.fb.group({
    title:       ['', [Validators.required, Validators.maxLength(100)]],
    quantity:    [1, [Validators.required, Validators.min(1)]],
    unit_price:  [0, [Validators.required, Validators.min(0)]],
    description: [''],
    item_url:    [''],
  });

  async ngOnInit(): Promise<void> {
    this.tripId = this.route.snapshot.paramMap.get('id')!;
    await this.loadItems();
  }

  async loadItems(): Promise<void> {
    this.items.set(await this.shoppingService.getByTrip(this.tripId));
  }

  async addItem(): Promise<void> {
    if (this.form.invalid) return;
    const { title, quantity, unit_price, description, item_url } = this.form.value;
    const qty = quantity!;
    const price = unit_price!;

    await this.shoppingService.create({
      trip_id: this.tripId,
      title: title!,
      quantity: qty,
      unit_price: price,
      total_amount: qty * price,
      description: description || undefined,
      item_url: item_url || undefined,
      is_bought: false,
    });
    this.form.reset({ quantity: 1, unit_price: 0 });
    await this.loadItems();
  }

  async toggleBought(item: ShoppingItem): Promise<void> {
    await this.shoppingService.toggleBought(item.client_record_id, item.is_bought);
    await this.loadItems();
  }

  async uploadImage(event: Event, itemId: string): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    await this.shoppingService.handleImageUpload(file, itemId);
    // 觸發 SyncEngine 上傳
    await this.syncEngine.syncUp();
    await this.loadItems();
  }

  async deleteItem(id: string): Promise<void> {
    await this.shoppingService.delete(id);
    await this.loadItems();
  }
}
